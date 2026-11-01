import type { AssetMeta, Dashboard, PageMeta } from '@shared/types'
import type { Events } from '@shared/protocol'
import { isPageBacked, kindOfPageType } from '../library/kinds'
import { timeline } from './store'

const RECENT_MS = 3000

export function observeData<K extends keyof Events>(event: K, payload: Events[K]): void {
  if (event === 'page.changed') {
    const { id, meta } = payload as Events['page.changed']
    if (!meta) return timeline.forgetMatching(id, isPageBacked)
    const m = meta as PageMeta
    timeline.record({ kind: kindOfPageType(m.type), entry: id, action: m.version <= 1 ? 'made' : 'changed' })
  } else if (event === 'asset.changed') {
    const { id, meta } = payload as Events['asset.changed']
    if (!meta) return timeline.forget('file', id)
    timeline.record({ kind: 'file', entry: id, action: Date.now() - (meta as AssetMeta).createdAt < RECENT_MS ? 'made' : 'changed' })
  } else if (event === 'dashboard.changed') {
    const { id, dashboard } = payload as Events['dashboard.changed']
    if (!dashboard) return timeline.forget('board', id)
    const d = dashboard as Dashboard
    timeline.record({ kind: 'board', entry: id, action: d.updatedAt - d.createdAt < RECENT_MS ? 'made' : 'changed' })
  }
}
