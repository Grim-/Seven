import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { spawn } from 'node:child_process'
import type { CudaInstallProgress } from '@shared/types'
import { extractZip } from './zip'

const NEEDED = ['cudart64_13.dll', 'cublas64_13.dll', 'cublasLt64_13.dll']
const TEST_TIMEOUT_MS = 60_000

export const CUDA_RUNTIME_DIR = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Seven', 'runtime', 'cuda13')

interface Wheel {
  url: string
  sha256: string
  size: number
  files: Record<string, string>
}

const WHEELS: Wheel[] = [
  {
    url: 'https://files.pythonhosted.org/packages/b7/94/6b867483bec07da24ffa32736c79fabb94ef3a7af4d787a9d4a974868576/nvidia_cuda_runtime-13.0.96-py3-none-win_amd64.whl',
    sha256: 'f79298c8a098cec150a597c8eba58ecdab96e3bdc4b9bc4f9983635031740492',
    size: 2927037,
    files: { 'nvidia/cu13/bin/x86_64/cudart64_13.dll': 'cudart64_13.dll' }
  },
  {
    url: 'https://files.pythonhosted.org/packages/f3/91/bda39230b7a4c102bb724c21b50823efc63544490a885fea0b604911c0ab/nvidia_cublas-13.0.2.14-py3-none-win_amd64.whl',
    sha256: '5f7a90456b1392db60e28719547ba6e00696bfa81304b6887cf287f9edf2c1d7',
    size: 401887280,
    files: { 'nvidia/cu13/bin/x86_64/cublas64_13.dll': 'cublas64_13.dll', 'nvidia/cu13/bin/x86_64/cublasLt64_13.dll': 'cublasLt64_13.dll' }
  }
]

export const CUDA_DOWNLOAD_BYTES = WHEELS.reduce((n, w) => n + w.size, 0)


export interface CudaSetup {
  roots: string[]
  found: Record<string, string | null>
  added: string[]
}

let setup: CudaSetup = { roots: [], found: {}, added: [] }

function exists(p: string): boolean {
  try {
    return fs.existsSync(p)
  } catch {
    return false
  }
}

function version(name: string): number[] {
  return (name.match(/\d+/g) ?? []).map(Number)
}

function newestFirst(a: string, b: string): number {
  const va = version(path.basename(a))
  const vb = version(path.basename(b))
  for (let i = 0; i < Math.max(va.length, vb.length); i++) if ((vb[i] ?? 0) !== (va[i] ?? 0)) return (vb[i] ?? 0) - (va[i] ?? 0)
  return 0
}

function cudaRoots(): string[] {
  const fromEnv = Object.entries(process.env)
    .filter(([key, value]) => /^CUDA_PATH(_V\d+_\d+)?$/i.test(key) && value)
    .map(([, value]) => (value as string).replace(/^"|"$/g, ''))
  const installed: string[] = []
  for (const base of new Set([process.env.ProgramW6432, process.env.ProgramFiles, 'C:\\Program Files'].filter((b): b is string => Boolean(b)))) {
    const container = path.join(base, 'NVIDIA GPU Computing Toolkit', 'CUDA')
    if (!exists(container)) continue
    for (const name of fs.readdirSync(container)) if (/^v\d/i.test(name)) installed.push(path.join(container, name))
  }
  const seen = new Set<string>()
  return [...fromEnv, ...installed.sort(newestFirst)].filter((r) => {
    const key = path.resolve(r).toLowerCase()
    if (seen.has(key) || !exists(r)) return false
    seen.add(key)
    return true
  })
}

export function cudaMissing(): string[] {
  return process.platform === 'win32' ? NEEDED.filter((dll) => !setup.found[dll]) : []
}

async function download(wheel: Wheel, file: string, signal: AbortSignal, onBytes: (n: number) => void): Promise<void> {
  const res = await fetch(wheel.url, { signal })
  if (!res.ok || !res.body) throw new Error(`Downloading ${path.basename(new URL(wheel.url).pathname)} failed: the server answered ${res.status}. Check your internet connection and try again.`)
  const hash = crypto.createHash('sha256')
  const count = new Transform({
    transform(chunk: Buffer, _enc, done) {
      hash.update(chunk)
      onBytes(chunk.length)
      done(null, chunk)
    }
  })
  await pipeline(Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]), count, fs.createWriteStream(file), { signal })
  if (hash.digest('hex') !== wheel.sha256) throw new Error(`${path.basename(new URL(wheel.url).pathname)} did not match NVIDIA's published checksum, so it was not used. Try again; if it keeps happening, the download is being changed on the way.`)
}

export async function installCudaRuntime(signal: AbortSignal, onProgress: (p: CudaInstallProgress) => void): Promise<CudaSetup> {
  if (process.platform !== 'win32') throw new Error('The CUDA libraries download is only for Windows.')
  fs.mkdirSync(CUDA_RUNTIME_DIR, { recursive: true })
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'seven-cuda-dl-'))
  let received = 0
  let last = 0
  const report = (stage: CudaInstallProgress['stage']) => onProgress({ stage, received, total: CUDA_DOWNLOAD_BYTES })
  try {
    for (const wheel of WHEELS) {
      const file = path.join(work, path.basename(new URL(wheel.url).pathname))
      await download(wheel, file, signal, (n) => {
        received += n
        if (Date.now() - last > 250) {
          last = Date.now()
          report('download')
        }
      })
      report('extract')
      const got = await extractZip(file, (name) => wheel.files[name] ?? null, CUDA_RUNTIME_DIR)
      const missing = Object.entries(wheel.files).filter(([name]) => !got.has(name)).map(([, target]) => target)
      if (missing.length) throw new Error(`${missing.join(', ')} was not in the download. Try again.`)
      fs.rmSync(file, { force: true })
    }
  } finally {
    fs.rmSync(work, { recursive: true, force: true })
  }
  report('done')
  return addCudaToPath()
}

export function addCudaToPath(): CudaSetup {
  if (process.platform !== 'win32') return setup
  const roots = cudaRoots()
  const dirs = [...roots.flatMap((r) => [path.join(r, 'bin', 'x64'), path.join(r, 'bin')]), CUDA_RUNTIME_DIR].filter(exists)
  const found = Object.fromEntries(NEEDED.map((dll) => [dll, dirs.map((d) => path.join(d, dll)).find(exists) ?? null]))
  const wanted = [...new Set(Object.values(found).filter((f): f is string => f !== null).map((f) => path.dirname(f)))]
  const current = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean)
  const keys = new Set(wanted.map((d) => path.resolve(d).toLowerCase()))
  const rest = current.filter((p) => !keys.has(path.resolve(p.replace(/^"|"$/g, '')).toLowerCase()))
  if (wanted.length) process.env.PATH = [...wanted, ...rest].join(path.delimiter)
  const root = wanted.length ? wanted[0].replace(/[\\/]bin([\\/]x64)?$/i, '') : null
  if (root && !process.env.CUDA_PATH) process.env.CUDA_PATH = root
  setup = { roots, found, added: wanted }
  return setup
}

async function cudaBinding(): Promise<string | null> {
  try {
    const name = ['@node-llama-cpp', 'win-x64-cuda'].join('/')
    const mod = (await import(/* @vite-ignore */ name)) as { getBinsDir: () => { binsDir: string } }
    const file = path.join(mod.getBinsDir().binsDir, 'win-x64-cuda', 'llama-addon.node')
    return exists(file) ? file : null
  } catch {
    return null
  }
}

const TEST_SCRIPT = `
const path = require('path')
const file = process.env.SEVEN_CUDA_BINDING
let binding
try {
  binding = require(file)
} catch (err) {
  console.error('Loading llama-addon.node failed: ' + (err && err.message ? err.message : String(err)))
  process.exit(1)
}
;(async () => {
  try {
    binding.loadBackends()
    let gpu = binding.getGpuType()
    if (gpu == null || gpu === false) {
      binding.loadBackends(path.dirname(path.resolve(file)))
      gpu = binding.getGpuType()
    }
    if (gpu == null || gpu === false) {
      console.error('ggml-cuda.dll did not load. Windows could not load it or one of the DLLs it needs (cublas64_13.dll, cublasLt64_13.dll, or the NVIDIA driver\\'s nvcuda.dll).')
      process.exit(2)
    }
    await binding.init()
    const type = binding.getGpuType()
    if (type !== 'cuda') {
      console.error('The CUDA build started a "' + type + '" backend instead of CUDA.')
      process.exit(3)
    }
    binding.ensureGpuDeviceIsSupported()
    console.log('ok')
    process.exit(0)
  } catch (err) {
    console.error(err && err.message ? err.message : String(err))
    process.exit(4)
  }
})()
`

function runTest(binding: string): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    let dir: string | null = null
    try {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seven-cuda-'))
      const script = path.join(dir, 'test.cjs')
      fs.writeFileSync(script, TEST_SCRIPT)
      const child = spawn(process.execPath, [script], {
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', SEVEN_CUDA_BINDING: binding },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
      })
      let output = ''
      child.stdout.on('data', (d: Buffer) => (output += d.toString()))
      child.stderr.on('data', (d: Buffer) => (output += d.toString()))
      const timer = setTimeout(() => child.kill(), TEST_TIMEOUT_MS)
      const finish = (ok: boolean, extra = '') => {
        clearTimeout(timer)
        if (dir) fs.rmSync(dir, { recursive: true, force: true })
        resolve({ ok, output: `${output}${extra}`.replace(/\x1b\[[0-9;]*m/g, '').trim() })
      }
      child.on('error', (err) => finish(false, `\nCould not start the test: ${err.message}`))
      child.on('exit', (code) => finish(code === 0 && /\bok\b/.test(output), code === 0 ? '' : `\n(exit code ${code})`))
    } catch (err) {
      if (dir) fs.rmSync(dir, { recursive: true, force: true })
      resolve({ ok: false, output: `Could not start the test: ${err instanceof Error ? err.message : String(err)}` })
    }
  })
}

export async function cudaDiagnosis(): Promise<string | null> {
  if (process.platform !== 'win32') return null
  const missing = NEEDED.filter((dll) => !setup.found[dll])
  if (missing.length) {
    const looked = [...setup.roots, CUDA_RUNTIME_DIR].join('; ')
    return `Seven could not find ${missing.join(', ')}, which node-llama-cpp's CUDA build needs (CUDA 13). Other apps usually bring their own copies, so they don't need these. Looked in: ${looked}. Use "Get CUDA libraries" below to download them for Seven (about ${Math.round(CUDA_DOWNLOAD_BYTES / 1e6)} MB, from NVIDIA's packages on PyPI), or install the CUDA 13 Toolkit.`
  }
  const where = setup.added.join(', ')
  const binding = await cudaBinding()
  if (!binding) return `The CUDA build of node-llama-cpp (@node-llama-cpp/win-x64-cuda) is not installed. Run npm install in the Seven folder. CUDA 13 libraries were found in ${where}.`
  const result = await runTest(binding)
  if (result.ok) return `A separate test of the CUDA build passes with the CUDA libraries in ${where}, so the failure is inside node-llama-cpp's own check.`
  return `The CUDA build failed when Seven tested it directly, with the CUDA libraries in ${where}:\n${result.output || 'no output'}`
}
