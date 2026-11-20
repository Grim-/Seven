import fs from 'node:fs'
import { runText } from '../util/run'
import type { Choice, ReleaseAsset, Settings } from './registry'

export interface Machine {
  cuda: [number, number] | null
  computeCaps: number[]
  vulkan: boolean
}

export interface VariantChoice {
  build: string
  label: string
  assets: ReleaseAsset[]
  unavailable: string | null
  notes: string[]
}

export function pattern(settings: Settings, key: string, context = 'server'): RegExp {
  const text = String(settings[key] ?? '')
  try {
    return new RegExp(text, 'i')
  } catch (err) {
    throw new Error(`The ${key} pattern in ${context} settings is not a valid regular expression: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export async function readMachine(settings: Settings, context = 'server'): Promise<Machine> {
  const [banner, caps] = await Promise.all([runText('nvidia-smi', []), runText('nvidia-smi', ['--query-gpu=compute_cap', '--format=csv,noheader'])])
  const cuda = banner?.match(pattern(settings, 'driverCudaPattern', context))
  return {
    cuda: cuda ? [Number(cuda[1]), Number(cuda[2])] : null,
    computeCaps: (caps ?? '')
      .split(/\r?\n/)
      .map((l) => Number(l.trim()))
      .filter((n) => Number.isFinite(n) && n > 0),
    vulkan: fs.existsSync(String(settings.vulkanLibrary ?? ''))
  }
}

interface CudaVersion {
  major: number
  minor: number
  label: string
}

function cudaOf(name: string, re: RegExp): CudaVersion | null {
  const m = name.match(re)
  if (!m) return null
  const major = Number(m[1])
  const hasMinor = m[2] !== undefined && m[2] !== ''
  const minor = hasMinor ? Number(m[2]) : 0
  return { major, minor, label: hasMinor ? `${major}.${minor}` : String(major) }
}

function newer(a: CudaVersion, b: CudaVersion): boolean {
  return a.major !== b.major ? a.major > b.major : a.minor > b.minor
}

export function cudaChoices(assets: ReleaseAsset[], m: Machine, settings: Settings, context = 'server'): VariantChoice[] {
  const buildRe = pattern(settings, 'cudaBuildPattern', context)
  const runtimeRe = pattern(settings, 'cudaRuntimePattern', context)
  const lowest = (settings.cudaLowestCompute ?? {}) as Record<string, number>
  const gpu = m.computeCaps.length ? Math.min(...m.computeCaps) : null
  const found: { v: CudaVersion; choice: VariantChoice }[] = []
  for (const a of assets) {
    const v = cudaOf(a.name, buildRe)
    if (!v) continue
    const runtime = assets.find((r) => {
      const rv = cudaOf(r.name, runtimeRe)
      return rv !== null && rv.major === v.major && rv.minor === v.minor
    })
    const notes: string[] = []
    let unavailable: string | null = null
    if (!m.cuda) unavailable = 'No NVIDIA driver found.'
    else if (v.major > m.cuda[0]) unavailable = `Needs a driver for CUDA ${v.major}; yours supports CUDA ${m.cuda.join('.')}.`
    else {
      if (v.major === m.cuda[0] && v.minor > m.cuda[1]) {
        notes.push(`Built with CUDA ${v.label}; your driver reports ${m.cuda.join('.')}. It runs through NVIDIA's minor version compatibility only if it has code compiled for your GPU.`)
      }
      const min = lowest[String(v.major)]
      if (min === undefined) notes.push(`No lowest compute capability is set for CUDA ${v.major} in settings, so it isn't checked.`)
      else if (gpu !== null && gpu < min) unavailable = `CUDA ${v.major} builds need compute capability ${min} or higher; your GPU has ${gpu}.`
    }
    found.push({ v, choice: { build: `cuda-${v.label}`, label: `CUDA ${v.label}`, assets: runtime ? [a, runtime] : [a], unavailable, notes } })
  }
  return found.sort((x, y) => (newer(x.v, y.v) ? -1 : newer(y.v, x.v) ? 1 : 0)).map((f) => f.choice)
}

export function singleVariantChoice(key: string, label: string, id: string, unavailable: string | null, context = 'server') {
  return (assets: ReleaseAsset[], settings: Settings): VariantChoice[] => {
    const re = pattern(settings, key, context)
    const build = assets.find((a) => re.test(a.name))
    return build ? [{ build: id, label, assets: [build], unavailable, notes: [] }] : []
  }
}

export function toChoices(list: VariantChoice[]): Choice[] {
  return list.map((c) => ({
    build: c.build,
    label: c.label,
    unavailable: c.unavailable,
    notes: c.notes,
    assets: c.assets,
    size: c.assets.reduce((n, a) => n + a.size, 0),
    files: c.assets.map((a) => ({ name: a.name, size: a.size }))
  }))
}

export async function serverVariantChoices(assets: ReleaseAsset[], settings: Settings, context = 'server'): Promise<Choice[]> {
  const m = await readMachine(settings, context)
  return toChoices([
    ...cudaChoices(assets, m, settings, context),
    ...singleVariantChoice('vulkanBuildPattern', 'Vulkan', 'vulkan', m.vulkan ? null : 'No Vulkan driver found.', context)(assets, settings),
    ...singleVariantChoice('cpuBuildPattern', 'CPU', 'cpu', null, context)(assets, settings)
  ])
}
