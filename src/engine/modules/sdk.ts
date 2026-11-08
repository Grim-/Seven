import fs from 'node:fs'
import path from 'node:path'
import type { JsonObjectSchema } from '../tools/schema'
import type { ToolPermission } from '@shared/types'
import { ToolBlocked, ToolError, optBool, optInt, optStr, str, type ToolContext, type ToolOutput } from '../tools/types'
import { data } from '../data/hub'
import { readBytes, readJson, readText, removePath, writeBytes, writeJson, writeText } from '../util/fs'
import { dataRoot } from '../util/paths'
import { vaultEvents } from '../util/secure'
import { getToolsPrefs } from './prefs'
import type { Manifest } from './manifest'

export const API_VERSION = 1

export interface ModuleTool {
  name: string
  description: string
  params: JsonObjectSchema | Record<string, unknown>
  execute(args: Record<string, unknown>, ctx: ToolContext): Promise<string | ToolOutput> | string | ToolOutput
  permission?: ToolPermission
  needsWorkspace?: boolean
  maxRepeats?: number
  fitsItself?: boolean
  command?: boolean
}

export interface ToolCollector {
  add(tool: ModuleTool): void
}

export interface ModuleLog {
  info(...args: unknown[]): void
  warn(...args: unknown[]): void
  error(...args: unknown[]): void
}

export interface ModuleContext {
  manifest: Manifest
  dir: string
  dataDir: string
  settings: Record<string, unknown>
  log: ModuleLog
}

const storages = new Set<WeakRef<ModuleStorage>>()

function forgetAll(): void {
  for (const ref of storages) {
    const storage = ref.deref()
    if (storage) storage.forget()
    else storages.delete(ref)
  }
}

vaultEvents.on('locked', forgetAll)
vaultEvents.on('unlocked', forgetAll)

export class ModuleStorage {
  private cache: Record<string, unknown> | null = null

  constructor(private file: string) {
    storages.add(new WeakRef(this))
  }

  forget(): void {
    this.cache = null
  }

  private get values(): Record<string, unknown> {
    this.cache ??= readJson<Record<string, unknown>>(this.file, {})
    return this.cache
  }

  get<T>(key: string, fallback: T): T {
    return key in this.values ? (this.values[key] as T) : fallback
  }

  set<T>(key: string, value: T): T {
    this.values[key] = value
    writeJson(this.file, this.values)
    return value
  }

  delete(key: string): void {
    delete this.values[key]
    writeJson(this.file, this.values)
  }

  all(): Record<string, unknown> {
    return { ...this.values }
  }
}

export class ModuleFiles {
  constructor(private dir: string) {}

  path(name: string): string {
    const file = path.resolve(this.dir, name)
    const rel = path.relative(this.dir, file)
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`"${name}" is outside this module's data folder. Use a file name or a path inside it, like notes.txt or saves/game1.json.`)
    return file
  }

  exists(name: string): boolean {
    return fs.existsSync(this.path(name))
  }

  readText(name: string): string {
    return readText(this.path(name))
  }

  writeText(name: string, text: string): void {
    writeText(this.path(name), text)
  }

  readBytes(name: string): Buffer {
    return readBytes(this.path(name))
  }

  writeBytes(name: string, data: Buffer): void {
    writeBytes(this.path(name), data)
  }

  delete(name: string): void {
    removePath(this.path(name))
  }

  list(): string[] {
    return fs.existsSync(this.dir) ? fs.readdirSync(this.dir).filter((n) => n !== 'storage.json' && !n.endsWith('.tmp')) : []
  }
}

export interface ModuleViewResult {
  values: unknown
  html?: string
}

export interface ModuleActionResult {
  message?: string
  data?: unknown
}

export interface ModulePage {
  id: string
  title: string
  type: string
  data: unknown
  body: string
}

export class ModulePages {
  constructor(private moduleId: string) {}

  private full(type: string): string {
    return `${this.moduleId}:${type}`
  }

  private wrap(p: { id: string; title: string; type: string | null; data: unknown; body: string }): ModulePage {
    return { id: p.id, title: p.title, type: (p.type ?? '').split(':')[1] ?? '', data: p.data, body: p.body }
  }

  list(type: string): { id: string; title: string }[] {
    return data.pages.ofType(this.full(type)).map((p) => ({ id: p.id, title: p.title }))
  }

  get(ref: string): ModulePage {
    const page = data.pages.get(ref)
    if (!page.type?.startsWith(`${this.moduleId}:`)) throw new ToolError(`"${page.title}" is not a page from this tool, so it can't be used here. Give one of this tool's own pages; find lists them.`)
    return this.wrap(page)
  }

  find(type: string, ref: string): ModulePage | null {
    const found = data.pages.find(ref, (p) => p.type === this.full(type))
    return found ? this.get(found.id) : null
  }

  create(type: string, title: string, value: unknown): ModulePage {
    return this.wrap(data.pages.create({ title, type: this.full(type), data: value }))
  }

  save(ref: string, value: unknown): ModulePage {
    this.get(ref)
    return this.wrap(data.pages.setData(ref, value))
  }
}

let viewNotifier: (moduleId: string) => void = () => undefined
let chatNudge: (sessionId: string, text: string) => void = () => undefined

export function setChatNudge(fn: (sessionId: string, text: string) => void): void {
  chatNudge = fn
}

let browserOpener: (url: string | null) => void = () => undefined

export function setBrowserOpener(fn: (url: string | null) => void): void {
  browserOpener = fn
}

export function setViewNotifier(fn: (moduleId: string) => void): void {
  viewNotifier = fn
}

export class ToolModule {
  readonly manifest: Manifest
  readonly id: string
  readonly dir: string
  readonly dataDir: string
  readonly settings: Record<string, unknown>
  readonly storage: ModuleStorage
  readonly files: ModuleFiles
  readonly log: ModuleLog
  readonly pages: ModulePages

  constructor(ctx: ModuleContext) {
    this.manifest = ctx.manifest
    this.id = ctx.manifest.id
    this.dir = ctx.dir
    this.dataDir = ctx.dataDir
    this.settings = ctx.settings
    this.log = ctx.log
    fs.mkdirSync(ctx.dataDir, { recursive: true })
    this.storage = new ModuleStorage(path.join(ctx.dataDir, 'storage.json'))
    this.files = new ModuleFiles(ctx.dataDir)
    this.pages = new ModulePages(ctx.manifest.id)
  }

  async init(): Promise<void> {}

  define(_tools: ToolCollector): void {
    throw new Error(`Module "${this.id}" has no define(tools) method. Add one that calls tools.add({...}) for each tool.`)
  }

  async view(): Promise<ModuleViewResult | null> {
    return null
  }

  async onAction(name: string, _payload: unknown): Promise<ModuleActionResult | string | void> {
    throw new ToolError(`Module "${this.id}" has no action "${name}". Handle it in onAction (or onPageAction for page buttons).`)
  }

  async pageView(_type: string, page: ModulePage): Promise<ModuleViewResult | null> {
    return (await this.view()) ?? { values: page.data }
  }

  async onPageAction(_type: string, _page: ModulePage, name: string, payload: unknown): Promise<ModuleActionResult | string | void> {
    return this.onAction(name, payload)
  }

  pageRoll(_type: string, _page: ModulePage): string | null {
    return null
  }

  pageDraw(type: string, page: ModulePage, count: number): string[] | null {
    const out: string[] = []
    for (let i = 0; i < count; i++) {
      const value = this.pageRoll(type, page)
      if (value === null) return null
      out.push(value)
    }
    return out
  }

  pageText(_type: string, page: ModulePage): string {
    const json = JSON.stringify(page.data ?? null, null, 1)
    return json.length > 4000 ? `${json.slice(0, 4000)}\n... more data ...` : json
  }

  refreshView(): void {
    viewNotifier(this.id)
  }

  nudgeChat(sessionId: string, text: string): void {
    chatNudge(sessionId, text)
  }

  openBrowser(url: string | null): void {
    browserOpener(url)
  }

  async dispose(): Promise<void> {}
}

export const sdk = {
  version: API_VERSION,
  ToolModule,
  ToolError,
  ToolBlocked,
  params: { str, optStr, optInt, optBool },
  data,
  paths: { dataRoot, skillsFolder: () => getToolsPrefs().skillsFolder },
  fetch: globalThis.fetch.bind(globalThis)
}

export type Sdk = typeof sdk

export type ModuleClass = new (ctx: ModuleContext) => ToolModule

export type ModuleFactory = (s: Sdk) => ModuleClass
