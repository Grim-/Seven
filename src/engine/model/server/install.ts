import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { execFile } from 'node:child_process'
import type { ServerInstallProgress, ServerRelease } from '@shared/types'
import { extractZip } from '../zip'

const RELEASES = 'https://api.github.com/repos/ggml-org/llama.cpp/releases?per_page=30'
const CUDA_BUILD = /^llama-.*-bin-win-cuda-(\d+)\.(\d+)-x64\.zip$/i
const CUDA_RUNTIME = /^cudart-llama-bin-win-cuda-(\d+)\.(\d+)-x64\.zip$/i
const VULKAN_BUILD = /^llama-.*-bin-win-vulkan-x64\.zip$/i
const CPU_BUILD = /^llama-.*-bin-win-cpu-x64\.zip$/i
const EXE = 'llama-server.exe'

interface Asset {
  name: string
  size: number
  browser_download_url: string
  digest?: string | null
}

interface Installed {
  tag: string
}

function appFolder(): string {
  const dir = process.env.SEVEN_APP
  if (!dir) throw new Error('Seven was started without its app folder (SEVEN_APP), so it does not know where to put llama-server. Restart Seven.')
  return dir
}

export function serverRoot(): string {
  return path.join(appFolder(), 'runtime', 'llama-server')
}

function installedFile(): string {
  return path.join(serverRoot(), 'installed.json')
}

export function installed(): Installed | null {
  try {
    const value = JSON.parse(fs.readFileSync(installedFile(), 'utf8')) as Partial<Installed>
    if (typeof value.tag !== 'string' || !value.tag) return null
    return fs.existsSync(path.join(serverRoot(), value.tag, EXE)) ? { tag: value.tag } : null
  } catch {
    return null
  }
}

export function serverExe(): string | null {
  const current = installed()
  return current ? path.join(serverRoot(), current.tag, EXE) : null
}

type Gpu = { kind: 'cuda'; version: [number, number] } | { kind: 'vulkan' } | { kind: 'cpu' }

function runSmi(): Promise<string | null> {
  return new Promise((resolve) => {
    execFile('nvidia-smi', [], { windowsHide: true }, (err, stdout) => resolve(err ? null : stdout))
  })
}

async function detectGpu(): Promise<Gpu> {
  const smi = await runSmi()
  const cuda = smi?.match(/CUDA Version:\s*(\d+)\.(\d+)/i)
  if (cuda) return { kind: 'cuda', version: [Number(cuda[1]), Number(cuda[2])] }
  return fs.existsSync(path.join(process.env.windir ?? 'C:\\Windows', 'System32', 'vulkan-1.dll')) ? { kind: 'vulkan' } : { kind: 'cpu' }
}

function cudaVersion(name: string, pattern: RegExp): [number, number] | null {
  const m = name.match(pattern)
  return m ? [Number(m[1]), Number(m[2])] : null
}

function newer(a: [number, number], b: [number, number]): boolean {
  return a[0] !== b[0] ? a[0] > b[0] : a[1] > b[1]
}

function pick(assets: Asset[], gpu: Gpu): Asset[] | null {
  if (gpu.kind === 'vulkan') {
    const build = assets.find((a) => VULKAN_BUILD.test(a.name))
    return build ? [build] : null
  }
  if (gpu.kind === 'cpu') {
    const build = assets.find((a) => CPU_BUILD.test(a.name))
    return build ? [build] : null
  }
  let best: { build: Asset; version: [number, number] } | null = null
  for (const a of assets) {
    const version = cudaVersion(a.name, CUDA_BUILD)
    if (!version || newer(version, gpu.version)) continue
    if (!best || newer(version, best.version)) best = { build: a, version }
  }
  if (!best) return null
  const v = best.version
  const runtime = assets.find((a) => {
    const rv = cudaVersion(a.name, CUDA_RUNTIME)
    return rv !== null && rv[0] === v[0] && rv[1] === v[1]
  })
  return runtime ? [best.build, runtime] : [best.build]
}

function describe(gpu: Gpu): string {
  return gpu.kind === 'cuda' ? `CUDA ${gpu.version.join('.')} (from your NVIDIA driver)` : gpu.kind === 'vulkan' ? 'Vulkan (no NVIDIA driver found)' : 'CPU (no NVIDIA driver or Vulkan found)'
}

async function latestAsset(signal?: AbortSignal): Promise<{ tag: string; assets: Asset[]; gpu: Gpu }> {
  const gpu = await detectGpu()
  const res = await fetch(RELEASES, { signal, headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Seven' } })
  if (!res.ok) throw new Error(`GitHub answered ${res.status} when Seven asked for the llama.cpp releases. Check your internet connection and try again.`)
  const releases = (await res.json()) as { tag_name: string; draft?: boolean; assets?: Asset[] }[]
  for (const release of releases) {
    if (release.draft) continue
    const assets = pick(release.assets ?? [], gpu)
    if (assets) return { tag: release.tag_name, assets, gpu }
  }
  const seen = releases.slice(0, 3).map((r) => `${r.tag_name}: ${(r.assets ?? []).map((a) => a.name).filter((n) => /win/i.test(n)).join(', ') || 'no Windows files'}`)
  throw new Error(`None of the last ${releases.length} llama.cpp releases has a Windows build Seven recognises for ${describe(gpu)}. Newest ones:\n${seen.join('\n')}`)
}

export async function serverRelease(signal?: AbortSignal): Promise<ServerRelease> {
  const current = installed()
  const latest = await latestAsset(signal).then((l) => l.tag)
  return { installed: current?.tag ?? null, latest }
}

async function download(asset: Asset, file: string, signal: AbortSignal, onBytes: (n: number) => void): Promise<void> {
  const res = await fetch(asset.browser_download_url, { signal, headers: { 'User-Agent': 'Seven' } })
  if (!res.ok || !res.body) throw new Error(`Downloading ${asset.name} failed: the server answered ${res.status}. Check your internet connection and try again.`)
  const hash = crypto.createHash('sha256')
  const count = new Transform({
    transform(chunk: Buffer, _enc, done) {
      hash.update(chunk)
      onBytes(chunk.length)
      done(null, chunk)
    }
  })
  await pipeline(Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]), count, fs.createWriteStream(file), { signal })
  const expected = asset.digest?.startsWith('sha256:') ? asset.digest.slice(7).toLowerCase() : null
  if (expected && hash.digest('hex') !== expected) throw new Error(`${asset.name} did not match the checksum GitHub published for it, so it was not used. Try again; if it keeps happening, the download is being changed on the way.`)
}

export async function installServer(signal: AbortSignal, onProgress: (p: ServerInstallProgress) => void): Promise<string> {
  if (process.platform !== 'win32') throw new Error('Seven only installs the Windows build of llama-server.')
  const { tag, assets } = await latestAsset(signal)
  const root = serverRoot()
  const target = path.join(root, tag)
  const staging = `${target}.part`
  fs.mkdirSync(root, { recursive: true })
  fs.rmSync(staging, { recursive: true, force: true })
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'seven-llama-dl-'))
  let received = 0
  let last = 0
  const total = assets.reduce((n, a) => n + a.size, 0)
  const report = (stage: ServerInstallProgress['stage']) => onProgress({ stage, received, total, tag })
  try {
    for (const asset of assets) {
      const file = path.join(work, asset.name)
      await download(asset, file, signal, (n) => {
        received += n
        if (Date.now() - last > 250) {
          last = Date.now()
          report('download')
        }
      })
    }
    report('extract')
    const [build, ...rest] = assets
    await extractZip(path.join(work, build.name), (name) => name, staging)
    const exe = fs.existsSync(path.join(staging, EXE)) ? '' : (fs.readdirSync(staging, { withFileTypes: true }).find((d) => d.isDirectory() && fs.existsSync(path.join(staging, d.name, EXE)))?.name ?? null)
    if (exe === null) throw new Error(`${build.name} has no ${EXE} in it. Seven can't use this release.`)
    const home = exe ? path.join(staging, exe) : staging
    for (const runtime of rest) await extractZip(path.join(work, runtime.name), (name) => path.basename(name), home)
    fs.rmSync(target, { recursive: true, force: true })
    fs.renameSync(home, target)
    fs.rmSync(staging, { recursive: true, force: true })
    const previous = installed()
    fs.writeFileSync(installedFile(), JSON.stringify({ tag } satisfies Installed, null, 2))
    if (previous && previous.tag !== tag) fs.rmSync(path.join(root, previous.tag), { recursive: true, force: true })
  } finally {
    fs.rmSync(work, { recursive: true, force: true })
    fs.rmSync(staging, { recursive: true, force: true })
  }
  report('done')
  return tag
}
