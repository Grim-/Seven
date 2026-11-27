import zlib from 'node:zlib'
import type { CarryAbout } from '@shared/carry'
import type {
  PortabilityEstimate,
  PortabilityFormat,
  PortableEntryRecord,
  PortableEstimateItem,
  PortableExportItemSpec,
  PortableFileMeta
} from '@shared/portability'
import { data } from '../data/hub'
import { USER, kindNamed, type Kind } from '../library/kinds'
import { assetsIn } from '../library/packing'
import { readPortabilityPrefs } from './prefs'

export type PortableKind = Kind & Required<Pick<Kind, 'pack' | 'unpack'>>

export function isPortableKind(k: Kind | undefined): k is PortableKind {
  return Boolean(k?.pack && k.unpack && k.portability?.canImport !== false)
}

export interface CollectedBundle {
  roots: { kind: string; id: string; title: string }[]
  entries: PortableEntryRecord[]
  files: { meta: PortableFileMeta; data: Buffer }[]
  about: CarryAbout
}

export function collectPortableBundle(specs: PortableExportItemSpec[], includeDependencies: boolean): CollectedBundle {
  const entries: PortableEntryRecord[] = []
  const roots: { kind: string; id: string; title: string }[] = []
  const seen = new Set<string>()
  const rootKeys = new Set(specs.map((s) => `${s.kind}/${s.id}`))

  const visit = (k: Kind, id: string, isRoot: boolean, options?: Record<string, unknown>) => {
    const key = `${k.kind}/${id}`
    if (seen.has(key)) return
    seen.add(key)

    if (includeDependencies) {
      for (const ref of k.uses?.(id, options) ?? []) {
        const dep = kindNamed(ref.kind)
        const resolved = dep?.pack ? dep.resolve(ref.id, USER) : null
        if (dep && resolved) {
          visit(dep, resolved, false)
        }
      }
    }

    if (k.pack) {
      const value = k.pack(id, options)
      if (value === undefined) {
        if (isRoot) throw new Error(`${k.title(id)} is built in, so every Seven already has it.`)
        return
      }
      const title = k.title(id)
      entries.push({ kind: k.kind, id, title, value, isDependency: !rootKeys.has(key) })
      if (isRoot) roots.push({ kind: k.kind, id, title })
    } else if (k.export && isRoot) {
      const exported = k.export(id, USER)
      entries.push({ kind: k.kind, id, title: exported.title || k.title(id), value: exported.json, isDependency: false })
      roots.push({ kind: k.kind, id, title: exported.title || k.title(id) })
    } else if (isRoot) {
      throw new Error(`${k.label} entries do not support structured export yet.`)
    }
  }

  for (const spec of specs) {
    const k = kindNamed(spec.kind)
    if (!k) throw new Error(`Unknown kind "${spec.kind}".`)
    if (k.portability?.canExport === false) throw new Error(`${k.plural} cannot be exported.`)
    visit(k, spec.id, true, spec.options)
  }

  const assetIds = assetsIn(entries.map((e) => e.value))
  const files = assetIds.map((id) => {
    const meta = data.assets.get(id)
    return {
      meta: { id: meta.id, name: meta.name, size: meta.size },
      data: data.assets.readBytes(meta)
    }
  })

  return {
    roots,
    entries,
    files,
    about: buildCarryAbout(entries, null, roots.length)
  }
}

export function buildCarryAbout(entries: PortableEntryRecord[], text: string | null, rootCount?: number): CarryAbout {
  const roots = entries.filter((e) => !e.isDependency)
  const deps = entries.filter((e) => e.isDependency)
  const primary = roots.at(-1) ?? entries.at(-1)
  if (!primary) {
    return {
      kind: null,
      label: 'Data',
      title: (text ?? '').trim().split('\n')[0].slice(0, 60) || 'Text snippet',
      also: []
    }
  }
  const k = kindNamed(primary.kind)
  const effectiveRoots = rootCount ?? roots.length
  if (effectiveRoots > 1) {
    const distinctKinds = new Set(roots.map((r) => kindNamed(r.kind)?.plural ?? r.kind))
    const label = distinctKinds.size === 1 ? [...distinctKinds][0] : 'Bundle'
    return {
      kind: distinctKinds.size === 1 ? primary.kind : null,
      label,
      title: `${effectiveRoots} ${distinctKinds.size === 1 ? label : 'items'}`,
      also: deps.slice(0, 12).map((d) => `${kindNamed(d.kind)?.label ?? d.kind}: ${d.title}`)
    }
  }
  return {
    kind: primary.kind,
    label: k?.label ?? primary.kind,
    title: primary.title,
    also: deps.slice(0, 12).map((d) => `${kindNamed(d.kind)?.label ?? d.kind}: ${d.title}`)
  }
}

export function estimatePortableBundle(args: {
  items: PortableExportItemSpec[]
  text?: string | null
  includeDependencies: boolean
  format: PortabilityFormat
}): PortabilityEstimate {
  const prefs = readPortabilityPrefs()
  const mb = 1024 * 1024

  if (!args.items.length) {
    const rawText = Buffer.byteLength(args.text ?? '', 'utf8')
    const compressedText = zlib.deflateSync(Buffer.from(args.text ?? '', 'utf8')).length
    return {
      rootCount: 0,
      dependencyCount: 0,
      totalEntries: 0,
      assetCount: 0,
      rawBytes: rawText,
      compressedBytes: compressedText,
      items: [],
      dependencies: [],
      exceedsJsonWarn: rawText > prefs.warnJsonMb * mb,
      exceedsCardWarn: compressedText > prefs.warnCardMb * mb,
      bundleRecommendedKinds: [],
      warnings: []
    }
  }

  const bundle = collectPortableBundle(args.items, args.includeDependencies)
  const estimateItems: PortableEstimateItem[] = []
  const dependencies: PortabilityEstimate['dependencies'] = []
  let entryRawTotal = 0

  const assetSizeById = new Map(bundle.files.map((f) => [f.meta.id, f.meta.size]))

  for (const e of bundle.entries) {
    const jsonBytes = Buffer.byteLength(JSON.stringify(e.value ?? null), 'utf8')
    entryRawTotal += jsonBytes
    const k = kindNamed(e.kind)
    const label = k?.label ?? e.kind
    if (e.isDependency) {
      dependencies.push({ kind: e.kind, label, id: e.id, title: e.title, rawBytes: jsonBytes })
    } else {
      const ownAssets = assetsIn(e.value)
      const assetBytes = ownAssets.reduce((sum, aid) => sum + (assetSizeById.get(aid) ?? 0), 0)
      estimateItems.push({
        kind: e.kind,
        label,
        id: e.id,
        title: e.title,
        rawBytes: jsonBytes + assetBytes,
        assetBytes,
        assetCount: ownAssets.length,
        preferBundle: Boolean(k?.portability?.preferBundle),
        bundleNote: k?.portability?.bundleNote ?? null
      })
    }
  }

  const totalAssetBytes = bundle.files.reduce((sum, f) => sum + f.meta.size, 0)
  const rawBytes = entryRawTotal + totalAssetBytes
  const estimatedJsonBytes = entryRawTotal + Math.ceil(totalAssetBytes * 1.34)
  const compressedBytes = zlib.deflateSync(Buffer.from(JSON.stringify(bundle.entries), 'utf8')).length + totalAssetBytes

  const exceedsJsonWarn = estimatedJsonBytes > prefs.warnJsonMb * mb
  const exceedsCardWarn = compressedBytes > prefs.warnCardMb * mb
  const bundleRecommendedKinds = [...new Set(estimateItems.filter((i) => i.preferBundle).map((i) => i.label))]

  const warnings: string[] = []
  if (args.format !== 'markdown' && bundleRecommendedKinds.length && args.format !== 'bundle') {
    warnings.push(`${bundleRecommendedKinds.join(', ')} include heavy maps or assets; Archive Bundle (.sevenpack) is strongly recommended.`)
  }
  if (args.format === 'json' && exceedsJsonWarn) {
    warnings.push(`Estimated JSON size (~${(estimatedJsonBytes / mb).toFixed(1)} MB) exceeds your ${prefs.warnJsonMb} MB threshold. Split per entry/kind or use Bundle (.sevenpack).`)
  }
  if (args.format === 'card' && exceedsCardWarn) {
    warnings.push(`Estimated PNG payload (~${(compressedBytes / mb).toFixed(1)} MB) exceeds your ${prefs.warnCardMb} MB card threshold.`)
  }

  return {
    rootCount: bundle.roots.length,
    dependencyCount: dependencies.length,
    totalEntries: bundle.entries.length,
    assetCount: bundle.files.length,
    rawBytes,
    compressedBytes,
    items: estimateItems,
    dependencies,
    exceedsJsonWarn,
    exceedsCardWarn,
    bundleRecommendedKinds,
    warnings
  }
}
