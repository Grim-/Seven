import { templateTool } from '../present/templates'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { EventEmitter } from 'node:events'
import type { GbnfJsonObjectSchema } from 'node-llama-cpp'
import type { ModuleInfo, ModuleSource, ModuleState, PageTypeInfo, ToolsPrefs } from '@shared/types'
import { data } from '../data/hub'
import type { SinglePage } from '../data/pages'
import type { ToolDef } from '../tools/types'
import { dataRoot } from '../util/paths'
import { readJson, writeJson } from '../util/fs'
import { secure, vaultEvents } from '../util/secure'
import { isVaultLocked } from '@shared/sealed'
import { ID_PATTERN, parseManifest, type Manifest } from './manifest'
import { sdk, type ModuleFactory, type ModulePage, type ModuleTool, type ToolModule } from './sdk'
import { toGrammarSchema } from './schema'
import { McpConnection } from './mcp'
import { builtinSources, readHelp, readRemind, type BuiltinSource } from './builtins'
import { getToolsPrefs, saveToolsPrefs } from './prefs'

const TRUST_FILE = path.join(dataRoot, 'tool-trust.json')
const SETTINGS_FILE = path.join(dataRoot, 'tool-settings.json')
const SECRETS_FILE = path.join(dataRoot, 'tool-secrets.json')

type Values = Record<string, Record<string, unknown>>

function readLocked(file: string): { value: Values; locked: boolean } {
  try {
    return { value: readJson<Values>(file, {}), locked: false }
  } catch (err) {
    if (isVaultLocked(err)) return { value: {}, locked: true }
    throw err
  }
}
const MODULE_DATA = path.join(dataRoot, 'moduledata')
const TOOL_NAME = /^[A-Za-z][A-Za-z0-9_]{0,63}$/
const SECRET_MASK = '••••••'

interface TrustRecord {
  hash: string
  files: Record<string, string>
  enabled: boolean
}

interface Entry {
  manifest: Manifest
  source: ModuleSource
  dir: string
  prompt: string
  help: string
  remind: string
  state: ModuleState
  error: string | null
  tools: ToolDef[]
  instance: ToolModule | null
  mcp: McpConnection | null
  hash: string
  files: Record<string, string>
  changedFiles: string[]
  replacesBuiltin: boolean
  builtin: BuiltinSource | null
}

function hashFolder(dir: string): { hash: string; files: Record<string, string> } {
  const files: Record<string, string> = {}
  const walk = (rel: string, depth: number) => {
    if (depth > 8) return
    for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name.startsWith('.seven-')) continue
      const relPath = rel ? `${rel}/${entry.name}` : entry.name
      if (entry.isDirectory()) walk(relPath, depth + 1)
      else if (entry.isFile()) files[relPath] = crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, relPath))).digest('hex')
    }
  }
  walk('', 0)
  const hash = crypto
    .createHash('sha256')
    .update(
      Object.keys(files)
        .sort()
        .map((f) => `${f}:${files[f]}`)
        .join('\n')
    )
    .digest('hex')
  return { hash, files }
}

function diffFiles(before: Record<string, string>, after: Record<string, string>): string[] {
  const out: string[] = []
  for (const f of Object.keys(after)) if (!(f in before)) out.push(`added ${f}`)
  for (const f of Object.keys(before)) if (!(f in after)) out.push(`removed ${f}`)
  for (const f of Object.keys(after)) if (f in before && before[f] !== after[f]) out.push(`changed ${f}`)
  return out.sort()
}

function isInside(child: string, parent: string): boolean {
  const rel = path.relative(parent, child)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

export class ModuleRegistry extends EventEmitter {
  private entries = new Map<string, Entry>()
  private prefs: ToolsPrefs = getToolsPrefs()
  private trust = readJson<Record<string, TrustRecord>>(TRUST_FILE, {})
  private values: Values = {}
  private secrets: Values = {}
  private valuesLocked = false
  private secretsLocked = false

  constructor() {
    super()
    this.readValues()
    vaultEvents.on('unlocked', () => {
      const pending = this.valuesLocked || this.secretsLocked
      this.readValues()
      if (pending) void this.reloadOn()
    })
  }

  private readValues(): void {
    const plain = readLocked(SETTINGS_FILE)
    const sealed = readLocked(SECRETS_FILE)
    this.valuesLocked = plain.locked
    this.secretsLocked = sealed.locked
    this.values = plain.value
    this.secrets = sealed.value
    if (plain.locked) return
    let moved = false
    for (const [id, saved] of Object.entries(this.values)) {
      const defs = this.entries.get(id)?.manifest.settings ?? []
      for (const def of defs) {
        if (!def.secret || !(def.name in saved)) continue
        this.secrets[id] = { ...(this.secrets[id] ?? {}), [def.name]: saved[def.name] }
        delete saved[def.name]
        moved = true
      }
    }
    if (moved && !sealed.locked) {
      writeJson(SECRETS_FILE, this.secrets)
      writeJson(SETTINGS_FILE, this.values)
    }
  }

  private async reloadOn(): Promise<void> {
    for (const [id, e] of this.entries) if (e.state === 'on' && e.manifest.settings.length) await this.reload(id).catch(() => undefined)
  }
  private watcher: fs.FSWatcher | null = null
  private timer: NodeJS.Timeout | null = null
  private started: Promise<void> | null = null
  private busy: Promise<void> = Promise.resolve()

  start(): Promise<void> {
    this.started ??= this.serial(() => this.scanAll())
    return this.started
  }

  ready(): Promise<void> {
    return this.start()
  }

  private serial(task: () => Promise<void>): Promise<void> {
    const next = this.busy.then(task, task)
    this.busy = next.catch(() => undefined)
    return next
  }

  getPrefs(): ToolsPrefs {
    return { ...this.prefs }
  }

  async setPrefs(patch: Partial<ToolsPrefs>): Promise<ToolsPrefs> {
    const next = { ...this.prefs }
    if (typeof patch.toolsFolder === 'string' && patch.toolsFolder.trim()) next.toolsFolder = path.resolve(patch.toolsFolder.trim())
    if (typeof patch.skillsFolder === 'string' && patch.skillsFolder.trim()) next.skillsFolder = path.resolve(patch.skillsFolder.trim())
    const moved = next.toolsFolder !== this.prefs.toolsFolder
    this.prefs = next
    saveToolsPrefs(next)
    if (moved) await this.serial(() => this.scanAll())
    this.emitChanged()
    return this.getPrefs()
  }

  toolsFolder(): string {
    return this.prefs.toolsFolder
  }

  isProtected(abs: string): boolean {
    return isInside(path.resolve(abs), this.prefs.toolsFolder)
  }

  private settingValues(entry: Entry): Record<string, unknown> {
    const saved = { ...(this.values[entry.manifest.id] ?? {}), ...(this.secrets[entry.manifest.id] ?? {}) }
    const out: Record<string, unknown> = {}
    for (const s of entry.manifest.settings) out[s.name] = s.name in saved ? saved[s.name] : s.default
    return out
  }

  private saveTrust(): void {
    writeJson(TRUST_FILE, this.trust)
  }

  private emitChanged(): void {
    this.emit('changed', this.list())
  }

  private readUserEntries(): Entry[] {
    const root = this.prefs.toolsFolder
    fs.mkdirSync(root, { recursive: true })
    const out: Entry[] = []
    for (const dirent of fs.readdirSync(root, { withFileTypes: true })) {
      if (!dirent.isDirectory() || dirent.name.startsWith('.')) continue
      const dir = path.join(root, dirent.name)
      const manifestFile = path.join(dir, 'module.json')
      if (!fs.existsSync(manifestFile)) continue
      const base: Omit<Entry, 'manifest' | 'state' | 'error'> = {
        source: 'user',
        dir,
        prompt: '',
        help: '',
        remind: '',
        tools: [],
        instance: null,
        mcp: null,
        hash: '',
        files: {},
        changedFiles: [],
        replacesBuiltin: false,
        builtin: null
      }
      try {
        const manifest = parseManifest(JSON.parse(fs.readFileSync(manifestFile, 'utf8')), dirent.name, false)
        const promptFile = path.join(dir, 'prompt.md')
        const { hash, files } = hashFolder(dir)
        out.push({ ...base, manifest, prompt: fs.existsSync(promptFile) ? fs.readFileSync(promptFile, 'utf8') : '', help: readHelp(dir), remind: readRemind(dir), state: 'off', error: null, hash, files })
      } catch (err) {
        const id = ID_PATTERN.test(dirent.name) ? dirent.name : `invalid-${dirent.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)}`
        out.push({
          ...base,
          manifest: parseManifest({ id, name: dirent.name }, id, false),
          state: 'error',
          error: `module.json: ${err instanceof Error ? err.message : String(err)}`
        })
      }
    }
    return out
  }

  private async scanAll(): Promise<void> {
    for (const entry of this.entries.values()) await this.unload(entry)
    this.entries.clear()
    const users = this.readUserEntries()
    const userIds = new Set(users.map((u) => u.manifest.id))
    const builtins = await builtinSources()
    for (const b of builtins) {
      if (userIds.has(b.manifest.id)) continue
      this.entries.set(b.manifest.id, {
        manifest: b.manifest,
        source: 'builtin',
        dir: b.dir,
        prompt: b.prompt,
        help: b.help,
        remind: b.remind,
        state: 'off',
        error: null,
        tools: [],
        instance: null,
        mcp: null,
        hash: '',
        files: {},
        changedFiles: [],
        replacesBuiltin: false,
        builtin: b
      })
    }
    const builtinIds = new Set(builtins.map((b) => b.manifest.id))
    for (const u of users) {
      if (this.entries.has(u.manifest.id)) {
        u.state = 'error'
        u.error = `Another folder already uses the id "${u.manifest.id}"`
        this.entries.set(`${u.manifest.id}~${path.basename(u.dir)}`, u)
        continue
      }
      u.replacesBuiltin = builtinIds.has(u.manifest.id)
      this.entries.set(u.manifest.id, u)
    }
    for (const entry of this.entries.values()) await this.evaluate(entry)
    this.checkClashes()
    this.watch()
    this.emitChanged()
  }

  private async evaluate(entry: Entry): Promise<void> {
    if (entry.state === 'error' && entry.error?.startsWith('module.json')) return
    const record = this.trust[entry.manifest.id]
    if (entry.source === 'builtin') {
      if (record && !record.enabled) {
        entry.state = 'off'
        return
      }
      await this.load(entry)
      return
    }
    if (!record) {
      entry.state = 'needs-enabling'
      entry.changedFiles = []
      return
    }
    if (record.hash !== entry.hash) {
      entry.state = 'changed'
      entry.changedFiles = diffFiles(record.files, entry.files)
      return
    }
    entry.changedFiles = []
    if (!record.enabled) {
      entry.state = 'off'
      return
    }
    await this.load(entry)
  }

  private toolFrom(entry: Entry, tool: ModuleTool | ToolDef): ToolDef {
    if (!tool || typeof tool !== 'object') throw new Error('define() passed tools.add something that is not a tool. Give tools.add an object with name, description, params and execute.')
    if (typeof tool.name !== 'string' || !TOOL_NAME.test(tool.name)) throw new Error(`Tool name "${String(tool.name)}" must be letters, numbers and _, starting with a letter`)
    if (typeof tool.execute !== 'function') throw new Error(`Tool "${tool.name}" has no execute function. Add one, e.g. async execute(args, ctx) { return 'done' }.`)
    const m = entry.manifest
    const params = entry.source === 'builtin' && !entry.builtin?.js ? (tool.params as GbnfJsonObjectSchema) : toGrammarSchema(tool.params)
    return {
      name: tool.name,
      group: m.id,
      description: typeof tool.description === 'string' ? tool.description : '',
      params,
      needsWorkspace: tool.needsWorkspace === true,
      ...(typeof tool.maxRepeats === 'number' ? { maxRepeats: tool.maxRepeats } : {}),
      ...(tool.fitsItself ? { fitsItself: true } : {}),
      ...('forAgent' in tool && typeof tool.forAgent === 'function' ? { forAgent: tool.forAgent } : {}),
      ...(tool.command ? { command: true } : {}),
      ...(m.always ? { always: true } : {}),
      permission: tool.permission ?? m.toolPermissions[tool.name] ?? m.permission,
      execute: async (args, ctx) => tool.execute(args, ctx)
    }
  }

  private async factoryFor(entry: Entry): Promise<ModuleFactory> {
    if (entry.builtin?.load) return entry.builtin.load()
    const entryFile = path.resolve(entry.dir, entry.manifest.entry)
    if (!isInside(entryFile, entry.dir) || !fs.existsSync(entryFile)) throw new Error(`Entry file "${entry.manifest.entry}" was not found in the module folder. Put it there, or set "entry" in module.json to the file that is.`)
    const pkg = readJson<{ type?: string } | null>(path.join(entry.dir, 'package.json'), null)
    let mod: unknown
    if (entryFile.endsWith('.mjs') || (pkg?.type === 'module' && !entryFile.endsWith('.cjs'))) {
      mod = await import(`${pathToFileURL(entryFile).href}?v=${entry.hash.slice(0, 12) || Date.now()}`)
    } else {
      const req = createRequire(entryFile)
      for (const key of Object.keys(req.cache)) if (isInside(key, entry.dir)) delete req.cache[key]
      mod = req(entryFile)
    }
    const factory = (mod as { default?: unknown })?.default ?? mod
    if (typeof factory !== 'function') throw new Error('The entry file must export a function: module.exports = (sdk) => class extends sdk.ToolModule { ... }')
    return factory as ModuleFactory
  }

  private async load(entry: Entry): Promise<void> {
    entry.state = 'loading'
    entry.error = null
    entry.tools = []
    const values = this.settingValues(entry)
    try {
      if (entry.manifest.kind === 'mcp') {
        void this.connectMcp(entry, values)
        return
      } else {
        const templates = entry.manifest.presentations.map((p) => templateTool(entry.manifest.id, entry.dir, p))
        if (templates.length && entry.source !== 'builtin' && !fs.existsSync(path.join(entry.dir, entry.manifest.entry))) {
          entry.tools = templates
          entry.state = 'on'
          return
        }
        const factory = await this.factoryFor(entry)
        const Cls = factory(sdk)
        if (typeof Cls !== 'function') throw new Error('The exported function must return a class extending sdk.ToolModule')
        const prefix = `[${entry.manifest.id}]`
        const instance = new Cls({
          manifest: entry.manifest,
          dir: entry.dir,
          dataDir: path.join(MODULE_DATA, entry.manifest.id),
          settings: values,
          log: { info: (...a) => console.log(prefix, ...a), warn: (...a) => console.warn(prefix, ...a), error: (...a) => console.error(prefix, ...a) }
        })
        await instance.init()
        const tools: ToolDef[] = []
        instance.define({ add: (t) => tools.push(this.toolFrom(entry, t)) })
        tools.push(...templates)
        if (!tools.length && !entry.manifest.toolless) throw new Error('The module defined no tools. Add at least one with tools.add in define(), or set "tools": false in module.json.')
        const defined = new Set(tools.map((t) => t.name))
        const unknown = entry.manifest.pages.flatMap((p) => p.actions.filter((a) => !defined.has(a)).map((a) => `${a} (on ${p.type})`))
        if (unknown.length) throw new Error(`module.json lists actions the module doesn't define: ${unknown.join(', ')}. Add the tools in define() or take them out of "actions".`)
        entry.instance = instance
        entry.tools = tools
      }
      entry.state = 'on'
    } catch (err) {
      await this.unload(entry)
      entry.state = 'error'
      entry.error = err instanceof Error ? err.message : String(err)
    }
  }

  private async connectMcp(entry: Entry, values: Record<string, unknown>): Promise<void> {
    const conn = new McpConnection(
      entry.manifest.id,
      entry.manifest.mcp!,
      values,
      () => {
        if (entry.mcp !== conn) return
        entry.tools = conn.moduleTools().map((t) => this.toolFrom(entry, t))
        this.checkClashes()
        this.emitChanged()
      },
      (reason) => {
        if (entry.mcp !== conn) return
        entry.state = 'error'
        entry.error = reason
        entry.tools = []
        this.emitChanged()
      }
    )
    entry.mcp = conn
    try {
      await Promise.race([conn.connect(), new Promise((_, reject) => setTimeout(() => reject(new Error('The server did not answer within 60 seconds. Check "command" (or "url") in its module.json, then reload it.')), 60_000))])
      if (entry.mcp !== conn) return
      entry.tools = conn.moduleTools().map((t) => this.toolFrom(entry, t))
      entry.state = 'on'
      this.checkClashes()
    } catch (err) {
      if (entry.mcp !== conn) return
      await this.unload(entry)
      entry.state = 'error'
      entry.error = err instanceof Error ? err.message : String(err)
    }
    this.emitChanged()
  }

  private async unload(entry: Entry): Promise<void> {
    const instance = entry.instance
    const conn = entry.mcp
    entry.instance = null
    entry.mcp = null
    entry.tools = []
    try {
      await instance?.dispose()
    } catch (err) {
      console.error(`[${entry.manifest.id}] dispose failed`, err)
    }
    await conn?.close()
  }

  private checkClashes(): void {
    const owner = new Map<string, string>()
    const ordered = [...this.entries.values()].sort((a, b) => (a.source === b.source ? a.manifest.id.localeCompare(b.manifest.id) : a.source === 'builtin' ? -1 : 1))
    for (const entry of ordered) {
      if (entry.state !== 'on') continue
      const clash = entry.tools.find((t) => owner.has(t.name))
      if (clash) {
        void this.unload(entry)
        entry.state = 'error'
        entry.error = `Tool "${clash.name}" is also defined by "${owner.get(clash.name)}". Rename it in one of the modules.`
        continue
      }
      for (const t of entry.tools) owner.set(t.name, entry.manifest.id)
    }
  }

  private watch(): void {
    this.watcher?.close()
    this.watcher = null
    try {
      this.watcher = fs.watch(this.prefs.toolsFolder, { recursive: true }, (_event, file) => {
        if (file && /(^|[\\/])(node_modules|\.git)([\\/]|$)/.test(String(file))) return
        if (this.timer) clearTimeout(this.timer)
        this.timer = setTimeout(() => void this.serial(() => this.rescan()), 400)
      })
    } catch (err) {
      console.error('Could not watch the tools folder', err)
    }
  }

  private async rescan(): Promise<void> {
    const users = this.readUserEntries()
    const seen = new Set<string>()
    for (const u of users) {
      const key = u.manifest.id
      seen.add(key)
      const current = this.entries.get(key)
      if (current && current.source === 'user' && current.hash === u.hash && current.error === null && u.error === null) continue
      if (current) await this.unload(current)
      u.replacesBuiltin = Boolean(current?.replacesBuiltin || current?.source === 'builtin')
      this.entries.set(key, u)
      await this.evaluate(u)
    }
    for (const [key, entry] of [...this.entries]) {
      if (entry.source === 'user' && !seen.has(key)) {
        await this.unload(entry)
        this.entries.delete(key)
      }
    }
    this.checkClashes()
    this.emitChanged()
  }

  private require(id: string): Entry {
    const entry = this.entries.get(id)
    if (!entry) throw new Error(`There is no module "${id}"`)
    return entry
  }

  async enable(id: string): Promise<ModuleInfo[]> {
    await this.serial(async () => {
      const entry = this.require(id)
      if (entry.source === 'user') {
        const fresh = hashFolder(entry.dir)
        entry.hash = fresh.hash
        entry.files = fresh.files
        this.trust[id] = { hash: fresh.hash, files: fresh.files, enabled: true }
      } else delete this.trust[id]
      this.saveTrust()
      await this.unload(entry)
      await this.evaluate(entry)
      this.checkClashes()
    })
    this.emitChanged()
    return this.list()
  }

  async disable(id: string): Promise<ModuleInfo[]> {
    await this.serial(async () => {
      const entry = this.require(id)
      const record = this.trust[id]
      this.trust[id] = { hash: record?.hash ?? entry.hash, files: record?.files ?? entry.files, enabled: false }
      this.saveTrust()
      await this.unload(entry)
      entry.state = 'off'
      entry.error = null
    })
    this.emitChanged()
    return this.list()
  }

  async reload(id: string): Promise<ModuleInfo[]> {
    await this.serial(async () => {
      const entry = this.require(id)
      await this.unload(entry)
      if (entry.source === 'user') {
        const [fresh] = this.readUserEntries().filter((u) => u.manifest.id === id)
        if (fresh) {
          fresh.replacesBuiltin = entry.replacesBuiltin
          this.entries.set(id, fresh)
          await this.evaluate(fresh)
        }
      } else await this.evaluate(entry)
      this.checkClashes()
    })
    this.emitChanged()
    return this.list()
  }

  async runAction(id: string, name: string): Promise<{ message: string | null }> {
    const entry = this.require(id)
    if (!entry.manifest.actions.some((a) => a.name === name)) throw new Error(`${entry.manifest.name} has no action "${name}"`)
    if (entry.state !== 'on' || !entry.instance) throw new Error(`Switch ${entry.manifest.name} on first`)
    const result = await entry.instance.onAction(name, null)
    const message = typeof result === 'string' ? result : result && typeof result === 'object' && typeof result.message === 'string' ? result.message : null
    return { message }
  }

  async setSettings(id: string, input: Record<string, unknown>): Promise<ModuleInfo[]> {
    const entry = this.require(id)
    if (this.valuesLocked || this.secretsLocked) throw new Error('Unlock the vault first, so saved settings are not lost')
    const saved = { ...(this.values[id] ?? {}) }
    const secret = { ...(this.secrets[id] ?? {}) }
    for (const def of entry.manifest.settings) {
      if (!(def.name in input)) continue
      const v = input[def.name]
      if (def.secret && v === SECRET_MASK) continue
      if (def.secret && v !== null && v !== '' && !secure.enabled) throw new Error(`Keys are only kept in the vault. Set up the vault in Settings → Vault, then add ${def.label}.`)
      if (def.secret && v !== null && v !== '' && !secure.unlocked) throw new Error(`Unlock the vault to add ${def.label}.`)
      const target = def.secret ? secret : saved
      if (v === null || v === '') delete target[def.name]
      else if (def.type === 'number' && Number.isFinite(Number(v))) target[def.name] = Number(v)
      else if (def.type === 'boolean') target[def.name] = v === true || v === 'true'
      else target[def.name] = String(v)
    }
    this.values[id] = saved
    writeJson(SETTINGS_FILE, this.values)
    if (entry.manifest.settings.some((d) => d.secret)) {
      this.secrets[id] = secret
      writeJson(SECRETS_FILE, this.secrets)
    }
    if (entry.state === 'on' || entry.state === 'error') return this.reload(id)
    this.emitChanged()
    return this.list()
  }

  async create(input: { id: string; name: string; kind: 'tools' | 'mcp' }): Promise<ModuleInfo[]> {
    const id = input.id.trim().toLowerCase()
    if (!ID_PATTERN.test(id)) throw new Error('A tool id uses lower-case letters, numbers and -, starting with a letter, e.g. my-tools.')
    const dir = path.join(this.prefs.toolsFolder, id)
    if (fs.existsSync(dir)) throw new Error(`The tools folder already has a "${id}" folder. Pick another id.`)
    fs.mkdirSync(dir, { recursive: true })
    const name = input.name.trim() || id
    if (input.kind === 'mcp') {
      writeJson(path.join(dir, 'module.json'), { id, name, description: '', type: 'mcp', transport: 'stdio', command: 'npx', args: ['-y', 'some-mcp-server'], env: {} })
    } else {
      writeJson(path.join(dir, 'module.json'), { id, name, description: 'What these tools are for.', version: '1.0.0', apiVersion: 1, entry: 'index.js', permission: 'ask', settings: [] })
      writeJson(path.join(dir, 'package.json'), { type: 'commonjs' })
      fs.writeFileSync(
        path.join(dir, 'index.js'),
        [
          'module.exports = (sdk) => class extends sdk.ToolModule {',
          '  define(tools) {',
          '    tools.add({',
          `      name: '${id.replace(/-/g, '_')}_hello',`,
          "      description: 'Says hello. Replace this with a real tool.',",
          "      params: { type: 'object', properties: { name: { type: 'string', description: 'Who to greet' } }, required: ['name'] },",
          "      permission: 'none',",
          '      async execute(args, ctx) {',
          '        return `Hello, ${args.name}!`',
          '      }',
          '    })',
          '  }',
          '}',
          ''
        ].join('\n')
      )
    }
    await this.serial(() => this.rescan())
    return this.list()
  }

  async importMcp(json: string): Promise<{ created: string[]; skipped: string[] }> {
    let parsed: unknown
    try {
      parsed = JSON.parse(json)
    } catch {
      throw new Error('That is not valid JSON. Paste the whole config, e.g. {"mcpServers": {"name": {"command": "npx", "args": []}}}.')
    }
    const servers = ((parsed as { mcpServers?: unknown })?.mcpServers ?? parsed) as Record<string, Record<string, unknown>>
    if (!servers || typeof servers !== 'object') throw new Error('Paste the servers as {"mcpServers": {"name": {...}}}, or as {"name": {...}} on its own.')
    const created: string[] = []
    const skipped: string[] = []
    for (const [name, cfg] of Object.entries(servers)) {
      const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/^(\d)/, 'm$1').slice(0, 48)
      const dir = path.join(this.prefs.toolsFolder, id)
      if (!id || !cfg || typeof cfg !== 'object' || fs.existsSync(dir)) {
        skipped.push(name)
        continue
      }
      const transport = cfg.type === 'sse' || cfg.transport === 'sse' ? 'sse' : cfg.url ? 'http' : 'stdio'
      fs.mkdirSync(dir, { recursive: true })
      writeJson(path.join(dir, 'module.json'), {
        id,
        name,
        description: '',
        type: 'mcp',
        transport,
        ...(cfg.command ? { command: cfg.command, args: cfg.args ?? [], env: cfg.env ?? {} } : {}),
        ...(cfg.cwd ? { cwd: cfg.cwd } : {}),
        ...(cfg.url ? { url: cfg.url, headers: cfg.headers ?? {} } : {})
      })
      created.push(id)
    }
    await this.serial(() => this.rescan())
    return { created, skipped }
  }

  tools(): ToolDef[] {
    return [...this.entries.values()].filter((e) => e.state === 'on').flatMap((e) => e.tools)
  }

  toolsOf(moduleId: string): ToolDef[] {
    const entry = this.entries.get(moduleId)
    return entry && entry.state === 'on' ? entry.tools : []
  }

  private pageModule(pageId: string): { entry: Entry; instance: ToolModule; spec: PageTypeInfo; page: ModulePage } {
    const page = data.pages.get(pageId)
    const [moduleId, type] = (page.type ?? '').split(':')
    const entry = this.entries.get(moduleId)
    if (!entry || entry.state !== 'on' || !entry.instance) throw new Error(entry ? `"${page.title}" is shown by ${entry.manifest.name}, which is off. Switch it on in Tools to open this page.` : `"${page.title}" needs ${moduleId ? `the ${moduleId} tool` : 'the tool that made it'}, which is not installed. Add it to the tools folder to open this page.`)
    const spec = entry.manifest.pages.find((p) => p.type === type)
    if (!spec) throw new Error(`${entry.manifest.name} has no page type "${type}" any more, so "${page.title}" can't be opened. Update or reload ${entry.manifest.name} in Tools.`)
    return { entry, instance: entry.instance, spec, page: { id: page.id, title: page.title, type, data: page.data, body: page.body } }
  }

  private readView(entry: Entry, file: string): string {
    const full = path.join(entry.dir, file)
    if (path.relative(entry.dir, full).startsWith('..')) throw new Error(`The view file "${file}" must be inside the module folder. Fix its path in module.json.`)
    return fs.readFileSync(full, 'utf8')
  }

  async pageView(pageId: string, part: string | null = null): Promise<{ html: string; values: unknown; module: string } | null> {
    const { entry, instance, spec, page } = this.pageModule(pageId)
    const file = part === 'widget' ? (spec.widget ?? spec.view) : part ? (spec.parts[part] ?? spec.view) : spec.view
    if (!file) return null
    const result = await instance.pageView(spec.type, page)
    const html = (file === spec.view && result?.html) || this.readView(entry, file)
    return { html, values: result ? result.values : page.data, module: entry.manifest.id }
  }

  async pageAction(pageId: string, name: string, payload: unknown): Promise<{ message: string | null }> {
    const { instance, spec, page } = this.pageModule(pageId)
    const result = await instance.onPageAction(spec.type, page, String(name), payload)
    if (result && typeof result === 'object' && 'data' in result && result.data !== undefined) data.pages.setData(page.id, result.data)
    const message = typeof result === 'string' ? result : result && typeof result === 'object' && typeof result.message === 'string' ? result.message : null
    return { message }
  }

  pageRoll(pageId: string): string | null {
    const { instance, spec, page } = this.pageModule(pageId)
    return instance.pageRoll(spec.type, page)
  }

  pageDraw(pageId: string, count: number): string[] | null {
    const { instance, spec, page } = this.pageModule(pageId)
    return instance.pageDraw(spec.type, page, count)
  }

  pageText(pageId: string): string | null {
    try {
      const { instance, spec, page } = this.pageModule(pageId)
      return instance.pageText(spec.type, page)
    } catch {
      return null
    }
  }

  pageTypes(): { module: string; spec: PageTypeInfo }[] {
    return [...this.entries.values()].filter((e) => e.state === 'on').flatMap((e) => e.manifest.pages.map((spec) => ({ module: e.manifest.id, spec })))
  }

  singlePages(): SinglePage[] {
    return this.pageTypes()
      .filter((t) => t.spec.single)
      .map((t) => ({ type: `${t.module}:${t.spec.type}`, label: t.spec.label }))
  }

  helpFor(id: string): string {
    const entry = this.entries.get(id)
    return entry?.state === 'on' ? entry.help.trim() : ''
  }

  panelTab(id: string): string {
    return this.entries.get(id)?.manifest.panel ? id : 'outputs'
  }

  remindFor(id: string): string {
    const entry = this.entries.get(id)
    return entry?.state === 'on' ? entry.remind.trim() : ''
  }

  promptFor(id: string): string {
    const entry = this.entries.get(id)
    return entry?.state === 'on' ? entry.prompt : ''
  }

  manifest(id: string): Manifest | null {
    return this.entries.get(id)?.manifest ?? null
  }

  list(): ModuleInfo[] {
    return [...this.entries.entries()]
      .map(([key, e]) => {
        const values = this.settingValues(e)
        for (const s of e.manifest.settings) if (s.secret && values[s.name]) values[s.name] = SECRET_MASK
        const mcp = e.manifest.mcp
        return {
          id: key,
          name: e.manifest.name,
          description: e.manifest.description,
          version: e.manifest.version,
          kind: e.manifest.kind,
          source: e.source,
          dir: e.dir,
          state: e.state,
          error: e.error,
          always: e.manifest.always,
          needsWorkspace: e.manifest.needsWorkspace,
          replacesBuiltin: e.replacesBuiltin,
          tools: e.tools.map((t) => ({ name: t.name, description: t.description, permission: t.permission ?? 'custom' })),
          settings: e.manifest.settings,
          actions: e.manifest.actions,
          panel: e.manifest.panel,
          pages: e.manifest.pages,
          values,
          changedFiles: e.changedFiles,
          mcp: mcp ? { transport: mcp.transport, target: mcp.transport === 'stdio' ? [mcp.command, ...mcp.args].join(' ') : (mcp.url ?? ''), status: e.mcp?.status ?? 'disconnected' } : null
        }
      })
      .sort((a, b) => (a.source === b.source ? a.name.localeCompare(b.name) : a.source === 'builtin' ? -1 : 1))
  }

  async dispose(): Promise<void> {
    this.watcher?.close()
    for (const entry of this.entries.values()) await this.unload(entry)
  }
}

export const modules = new ModuleRegistry()
