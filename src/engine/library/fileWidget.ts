import type { AssetMeta, WidgetSource } from '@shared/types'
import { ASSET_VIEWS } from '@shared/widgets'
import { data } from '../data/hub'
import { DataError } from '../data/validate'
import type { KindWidget } from '../data/widgetSources'

interface FileSource extends WidgetSource {
  kind: 'file'
  assetIds: string[]
}

const idsOf = (source: WidgetSource) => ((source as FileSource).assetIds ?? []).map((a) => String(a).trim()).filter(Boolean)
const metasOf = (source: WidgetSource): AssetMeta[] => idsOf(source).map((id) => data.assets.get(id))
const only = (metas: AssetMeta[], kind: string) => metas.length > 0 && metas.every((m) => m.kind === kind)
const GATHERED = ['image', 'audio']

export const FILE_WIDGET: KindWidget = {
  views: ASSET_VIEWS,
  defaultView: 'auto',
  check: (source) => {
    const ids = idsOf(source)
    if (!ids.length) throw new DataError('Give at least one file id. find with kind file lists them.')
    const missing = ids.filter((id) => !data.assets.exists(id))
    if (missing.length) throw new DataError(`Unknown file ids: ${missing.join(', ')}. find with kind file lists them.`)
    return { kind: 'file', assetIds: [...new Set(ids)] }
  },
  title: (source) => {
    const metas = metasOf(source)
    if (metas.length === 1) return metas[0].name
    if (only(metas, 'image')) return `${metas.length} pictures`
    if (only(metas, 'audio')) return `Playlist (${metas.length})`
    return `${metas.length} files`
  },
  describe: (source) => `files ${idsOf(source).join(', ')}`,
  size: (source) => {
    const metas = metasOf(source)
    if (only(metas, 'audio')) return metas.length > 1 ? { w: 4, h: 6 } : { w: 4, h: 3 }
    if (only(metas, 'video')) return { w: 6, h: 7 }
    if (only(metas, 'pdf')) return { w: 6, h: 10 }
    if (only(metas, 'image')) return metas.length > 1 ? { w: 6, h: 6 } : { w: 4, h: 6 }
    return { w: 4, h: 6 }
  },
  merge: (sources) => {
    const byKind = new Map<string, string[]>()
    for (const id of new Set(sources.flatMap(idsOf))) {
      const kind = data.assets.get(id).kind
      byKind.set(kind, [...(byKind.get(kind) ?? []), id])
    }
    return [...byKind.entries()].flatMap(([kind, ids]) => (GATHERED.includes(kind) ? [{ kind: 'file', assetIds: ids }] : ids.map((id) => ({ kind: 'file', assetIds: [id] }))))
  },
  formerly: ['assets']
}
