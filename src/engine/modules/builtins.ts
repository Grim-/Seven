/// <reference types="vite/client" />
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseManifest, type Manifest } from './manifest'
import type { ModuleFactory } from './sdk'

export interface BuiltinSource {
  manifest: Manifest
  dir: string
  prompt: string
  help: string
  remind: string
  js: boolean
  load: (() => Promise<ModuleFactory>) | null
}

let cache: Promise<BuiltinSource[]> | null = null

export function builtinSources(): Promise<BuiltinSource[]> {
  cache ??= collect()
  return cache
}

function idFrom(key: string): string {
  return key.split('/').slice(-2, -1)[0] ?? key
}

export function readHelp(dir: string): string {
  const file = path.join(dir, 'help.md')
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
}

export function readRemind(dir: string): string {
  const file = path.join(dir, 'remind.md')
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
}

function resourcesDir(): string {
  return process.env.SEVEN_RESOURCES || path.join(process.cwd(), 'resources')
}

function bundled(): BuiltinSource[] | null {
  let manifests: Record<string, unknown>
  let codes: Record<string, unknown>
  let prompts: Record<string, unknown>
  let helps: Record<string, unknown>
  let reminds: Record<string, unknown>
  try {
    manifests = import.meta.glob('../../modules/*/module.json', { eager: true, import: 'default' })
    codes = import.meta.glob('../../modules/*/index.ts', { eager: true, import: 'default' })
    prompts = import.meta.glob('../../modules/*/prompt.md', { eager: true, query: '?raw', import: 'default' })
    helps = import.meta.glob('../../modules/*/help.md', { eager: true, query: '?raw', import: 'default' })
    reminds = import.meta.glob('../../modules/*/remind.md', { eager: true, query: '?raw', import: 'default' })
  } catch {
    return null
  }
  const out: BuiltinSource[] = []
  for (const [key, raw] of Object.entries(manifests)) {
    const id = idFrom(key)
    const code = Object.entries(codes).find(([k]) => idFrom(k) === id)?.[1]
    const prompt = Object.entries(prompts).find(([k]) => idFrom(k) === id)?.[1]
    const help = Object.entries(helps).find(([k]) => idFrom(k) === id)?.[1]
    const remind = Object.entries(reminds).find(([k]) => idFrom(k) === id)?.[1]
    if (typeof code !== 'function') continue
    out.push({ manifest: parseManifest(raw, id, true), dir: '', prompt: typeof prompt === 'string' ? prompt : '', help: typeof help === 'string' ? help : '', remind: typeof remind === 'string' ? remind : '', js: false, load: async () => code as ModuleFactory })
  }
  return out
}

function fromSource(): BuiltinSource[] {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../modules')
  const out: BuiltinSource[] = []
  for (const id of fs.existsSync(root) ? fs.readdirSync(root) : []) {
    const dir = path.join(root, id)
    const manifestFile = path.join(dir, 'module.json')
    if (!fs.existsSync(manifestFile)) continue
    const promptFile = path.join(dir, 'prompt.md')
    out.push({
      manifest: parseManifest(JSON.parse(fs.readFileSync(manifestFile, 'utf8')), id, true),
      dir: '',
      prompt: fs.existsSync(promptFile) ? fs.readFileSync(promptFile, 'utf8') : '',
      help: readHelp(dir),
      remind: readRemind(dir),
      js: false,
      load: async () => (await import(pathToFileURL(path.join(dir, 'index.ts')).href)).default as ModuleFactory
    })
  }
  return out
}

function jsBuiltins(): BuiltinSource[] {
  const root = path.join(resourcesDir(), 'tools')
  const out: BuiltinSource[] = []
  for (const id of fs.existsSync(root) ? fs.readdirSync(root) : []) {
    const dir = path.join(root, id)
    const manifestFile = path.join(dir, 'module.json')
    if (!fs.existsSync(manifestFile)) continue
    try {
      const promptFile = path.join(dir, 'prompt.md')
      out.push({
        manifest: parseManifest(JSON.parse(fs.readFileSync(manifestFile, 'utf8')), id, true),
        dir,
        prompt: fs.existsSync(promptFile) ? fs.readFileSync(promptFile, 'utf8') : '',
        help: readHelp(dir),
        remind: readRemind(dir),
        js: true,
        load: null
      })
    } catch (err) {
      console.error(`Built-in module ${id} has a bad module.json`, err)
    }
  }
  return out
}

async function collect(): Promise<BuiltinSource[]> {
  return [...(bundled() ?? fromSource()), ...jsBuiltins()]
}
