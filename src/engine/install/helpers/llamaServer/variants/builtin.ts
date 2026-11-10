import type { ReleaseAsset, Settings } from '../../../registry'
import { pattern } from '../machine'
import { registerVariant, type VariantChoice } from './registry'

function cudaOf(name: string, re: RegExp): [number, number] | null {
  const m = name.match(re)
  return m ? [Number(m[1]), Number(m[2])] : null
}

function newer(a: [number, number], b: [number, number]): boolean {
  return a[0] !== b[0] ? a[0] > b[0] : a[1] > b[1]
}

function single(key: string, label: string, id: string, unavailable: string | null) {
  return (assets: ReleaseAsset[], settings: Settings): VariantChoice[] => {
    const re = pattern(settings, key)
    const build = assets.find((a) => re.test(a.name))
    return build ? [{ build: id, label, assets: [build], unavailable, notes: [] }] : []
  }
}

registerVariant({
  id: 'cuda',
  rank: 3,
  choices(assets, m, settings) {
    const buildRe = pattern(settings, 'cudaBuildPattern')
    const runtimeRe = pattern(settings, 'cudaRuntimePattern')
    const lowest = (settings.cudaLowestCompute ?? {}) as Record<string, number>
    const gpu = m.computeCaps.length ? Math.min(...m.computeCaps) : null
    const found: { v: [number, number]; choice: VariantChoice }[] = []
    for (const a of assets) {
      const v = cudaOf(a.name, buildRe)
      if (!v) continue
      const runtime = assets.find((r) => {
        const rv = cudaOf(r.name, runtimeRe)
        return rv !== null && rv[0] === v[0] && rv[1] === v[1]
      })
      const name = v.join('.')
      const notes: string[] = []
      let unavailable: string | null = null
      if (!m.cuda) unavailable = 'No NVIDIA driver found.'
      else if (v[0] > m.cuda[0]) unavailable = `Needs a driver for CUDA ${v[0]}; yours supports CUDA ${m.cuda.join('.')}.`
      else {
        if (v[0] === m.cuda[0] && v[1] > m.cuda[1]) notes.push(`Built with CUDA ${name}; your driver reports ${m.cuda.join('.')}. It runs through NVIDIA's minor version compatibility only if it has code compiled for your GPU.`)
        const min = lowest[String(v[0])]
        if (min === undefined) notes.push(`No lowest compute capability is set for CUDA ${v[0]} in settings, so it isn't checked.`)
        else if (gpu !== null && gpu < min) unavailable = `CUDA ${v[0]} builds need compute capability ${min} or higher; your GPU has ${gpu}.`
      }
      found.push({ v, choice: { build: `cuda-${name}`, label: `CUDA ${name}`, assets: runtime ? [a, runtime] : [a], unavailable, notes } })
    }
    return found.sort((x, y) => (newer(x.v, y.v) ? -1 : newer(y.v, x.v) ? 1 : 0)).map((f) => f.choice)
  }
})

registerVariant({
  id: 'vulkan',
  rank: 2,
  choices: (assets, m, settings) => single('vulkanBuildPattern', 'Vulkan', 'vulkan', m.vulkan ? null : 'No Vulkan driver found.')(assets, settings)
})

registerVariant({
  id: 'cpu',
  rank: 1,
  choices: (assets, _m, settings) => single('cpuBuildPattern', 'CPU', 'cpu', null)(assets, settings)
})
