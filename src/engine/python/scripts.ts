import { noteFailure } from '../util/report'
import fs from 'node:fs'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import type { AssetMeta, PythonRun, PythonScript } from '@shared/types'
import { ToolError } from '../tools/types'
import { dataRoot } from '../util/paths'
import { readJson, removePath, writeJson } from '../util/fs'
import { findNewMedia } from '../tools/outputs'
import { data } from '../data/hub'
import { killTree } from '../tools/shell'
import { modules } from '../modules/registry'

const MAX_OUTPUT = 60_000
const KEEP_RUNS = 10
const DIR = path.join(dataRoot, 'moduledata', 'python', 'scripts')

export interface RunResult {
  text: string
  output: string
  exit: number | null
  files: AssetMeta[]
}

export interface RunHooks {
  signal?: AbortSignal
  onOutput?: (chunk: string) => void
  sessionId?: string | null
  checkpoint?: (abs: string, previous: Buffer | null) => void
}

function settings(): Record<string, unknown> {
  return modules.valuesOf('python')
}

let found: { cmd: string; args: string[]; key: string } | null = null

export const ENV_DIR = path.join(dataRoot, 'moduledata', 'python', 'env')

export const ENV_PACKAGES = ['numpy', 'pandas', 'networkx', 'pillow', 'opencv-python', 'piexif', 'stegano', 'fpdf2', 'graphviz', 'jinja2', 'folium', 'mido', 'gTTS', 'trimesh', 'd20', 'requests', 'beautifulsoup4', 'crayons', 'colorama']

export function envPython(): string {
  return process.platform === 'win32' ? path.join(ENV_DIR, 'Scripts', 'python.exe') : path.join(ENV_DIR, 'bin', 'python')
}

function python(): { cmd: string; args: string[] } {
  const given = String(settings().pythonPath ?? '').trim().replace(/^"|"$/g, '')
  if (given) {
    if (found && found.key === given) return found
    if (!fs.existsSync(given) && path.isAbsolute(given)) throw new ToolError(`Python was not found at ${given}. Fix the path in Tools > Python.`)
    found = { cmd: given, args: [], key: given }
    return found
  }
  const env = envPython()
  if (fs.existsSync(env)) {
    if (found?.key !== `env:${env}`) found = { cmd: env, args: [], key: `env:${env}` }
    return found
  }
  if (found && found.key === '') return found
  return basePython()
}

function basePython(): { cmd: string; args: string[] } {
  const tries = process.platform === 'win32' ? [{ cmd: 'py', args: ['-3'] }, { cmd: 'python', args: [] }] : [{ cmd: 'python3', args: [] }, { cmd: 'python', args: [] }]
  for (const t of tries) {
    const r = spawnSync(t.cmd, [...t.args, '--version'], { windowsHide: true, encoding: 'utf8', timeout: 5000 })
    if (r.status === 0) {
      found = { ...t, key: '' }
      return found
    }
  }
  throw new ToolError('No Python found on PATH. Install Python, or set its path in Tools > Python.')
}

function runStep(cmd: string, args: string[], log: string[]): Promise<number | null> {
  return new Promise((resolve) => {
    log.push(`> ${cmd} ${args.join(' ')}`)
    const child = spawn(cmd, args, { windowsHide: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } })
    const take = (b: Buffer) => log.push(...b.toString('utf8').split(/\r?\n/).filter((l) => l.trim()))
    child.stdout.on('data', take)
    child.stderr.on('data', take)
    child.on('error', (err) => {
      log.push(String(err))
      resolve(null)
    })
    child.on('close', (code) => resolve(code))
  })
}

export async function setupEnv(): Promise<string> {
  const log: string[] = []
  const logFile = path.join(path.dirname(ENV_DIR), 'env-setup.log')
  const finish = (ok: boolean, message: string) => {
    fs.mkdirSync(path.dirname(ENV_DIR), { recursive: true })
    fs.writeFileSync(logFile, log.join('\n'), 'utf8')
    found = null
    if (!ok) throw new ToolError(`${message}\n${log.slice(-15).join('\n')}\nFull log: ${logFile}`)
    return message
  }
  if (!fs.existsSync(envPython())) {
    const base = basePython()
    const code = await runStep(base.cmd, [...base.args, '-m', 'venv', ENV_DIR], log)
    if (code !== 0 || !fs.existsSync(envPython())) return finish(false, 'Could not create the environment.')
  }
  const code = await runStep(envPython(), ['-m', 'pip', 'install', '--upgrade', ...ENV_PACKAGES], log)
  if (code !== 0) return finish(false, 'Installing the packages failed.')
  return finish(true, `The Python environment is ready in ${ENV_DIR}, with ${ENV_PACKAGES.join(', ')}. Scripts use it unless a Python path is set.`)
}

export function workFolder(): string {
  const set = String(settings().workFolder ?? '').trim()
  const dir = set || path.join(dataRoot, 'sandbox', 'python')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function runCode(code: string, hooks: RunHooks = {}): Promise<RunResult> {
  const py = python()
  const dir = workFolder()
  const limit = Math.max(1, Math.min(600, Number(settings().timeout) || 30))
  const script = path.join(dir, `.seven_run_${Date.now().toString(36)}.py`)
  fs.writeFileSync(script, code, 'utf8')
  const started = Date.now() - 1000
  return new Promise((resolve) => {
    let out = ''
    let timedOut = false
    const child = spawn(py.cmd, [...py.args, script], { cwd: dir, windowsHide: true, env: { ...process.env, PYTHONUNBUFFERED: '1', PYTHONIOENCODING: 'utf-8', MPLBACKEND: 'Agg' } })
    const add = (chunk: Buffer) => {
      const text = chunk.toString('utf8')
      if (out.length < MAX_OUTPUT) out += text
      hooks.onOutput?.(text)
    }
    child.stdout.on('data', add)
    child.stderr.on('data', add)
    const timer = setTimeout(() => {
      timedOut = true
      if (child.pid) killTree(child.pid)
    }, limit * 1000)
    const abort = () => child.pid && killTree(child.pid)
    hooks.signal?.addEventListener('abort', abort, { once: true })
    const finish = (exit: number | null, error?: Error) => {
      clearTimeout(timer)
      hooks.signal?.removeEventListener('abort', abort)
      fs.rmSync(script, { force: true })
      const files: AssetMeta[] = []
      for (const file of findNewMedia(dir, started)) {
        try {
          files.push(data.assets.register(file, { tool: 'run_python', sessionId: hooks.sessionId ?? null, original: path.basename(file) }, { checkpoint: hooks.checkpoint }))
        } catch (err) {
          noteFailure(err, 'python', "Could not add a script's output file")
          continue
        }
      }
      const head = error ? `Could not start Python: ${error.message}` : timedOut ? `Stopped after ${limit} seconds (time limit).` : `Exit code ${exit}.`
      const body = out.length >= MAX_OUTPUT ? `${out.slice(0, MAX_OUTPUT)}\n… output cut off` : out
      const shown = files.length ? `\nShown to the user: ${files.map((a) => `${a.name} (${a.id})`).join(', ')}` : ''
      resolve({ text: `${head}\n${body || '(No output. Use print() to show results.)'}${shown}`, output: body, exit: error || timedOut ? null : exit, files })
    }
    child.on('error', (err) => finish(null, err))
    child.on('close', (exit) => finish(exit))
  })
}

function slug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48)
}

function savedNames(names: string[]): string {
  if (!names.length) return 'No scripts are saved yet, so give the Python code itself instead.'
  if (names.length > 12) return 'find with kind script lists the saved scripts.'
  return `Use one of these names: ${names.join(', ')}.`
}

class ScriptStore {
  private changed: () => void = () => undefined

  onChange(fn: () => void): void {
    this.changed = fn
  }

  private file(id: string): string {
    return path.join(DIR, `${id}.json`)
  }

  list(): PythonScript[] {
    if (!fs.existsSync(DIR)) return []
    return fs
      .readdirSync(DIR)
      .filter((n) => n.endsWith('.json'))
      .map((n) => readJson<PythonScript | null>(path.join(DIR, n), null))
      .filter((s): s is PythonScript => Boolean(s?.id))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  find(ref: string): PythonScript | null {
    const r = ref.trim().toLowerCase()
    return this.list().find((s) => s.id === ref || s.name.toLowerCase() === r || s.id === slug(ref)) ?? null
  }

  get(ref: string): PythonScript {
    const s = this.find(ref)
    if (!s) throw new ToolError(`There is no saved script "${ref}". ${savedNames(this.list().map((x) => x.name))}`)
    return s
  }

  save(input: { name: string; code: string; description?: string | null; id?: string | null }): PythonScript {
    const name = input.name.trim()
    if (!name) throw new ToolError('Give the script a name, e.g. "Resize photos".')
    if (!input.code.trim()) throw new ToolError('The script has no code. Put the Python code in it before saving.')
    const existing = input.id ? this.find(input.id) : this.find(name)
    const id = existing?.id ?? (slug(name) || `script_${Date.now().toString(36)}`)
    const now = Date.now()
    const script: PythonScript = {
      id,
      name,
      description: (input.description ?? existing?.description ?? '').trim(),
      code: input.code,
      runs: existing?.runs ?? [],
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    }
    fs.mkdirSync(DIR, { recursive: true })
    writeJson(this.file(id), script)
    this.changed()
    return script
  }

  delete(ref: string): void {
    const s = this.get(ref)
    removePath(this.file(s.id))
    this.changed()
  }

  async run(ref: string, hooks: RunHooks = {}): Promise<{ script: PythonScript; result: RunResult }> {
    const s = this.get(ref)
    const result = await runCode(s.code, hooks)
    const run: PythonRun = { at: Date.now(), exit: result.exit, output: result.output.slice(0, 4000), files: result.files.map((f) => f.id) }
    const next = { ...s, runs: [run, ...s.runs].slice(0, KEEP_RUNS) }
    writeJson(this.file(s.id), next)
    this.changed()
    return { script: next, result }
  }
}

export const scripts = new ScriptStore()
