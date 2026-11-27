import MiniSearch from 'minisearch'
import { onStorageChange } from '../../util/fs'
import { vaultEvents } from '../../util/secure'
import { parseQuery } from '../query'
import type { Kind, KindContext, KindHit } from './types'

interface Doc {
  i: number
  id: string
  title: string
}

interface Near {
  sig: string
  all: KindHit[]
  index: MiniSearch<Doc>
}

const built = new Map<string, Near>()
const forget = () => built.clear()
onStorageChange(forget)
vaultEvents.on('locked', forget)
vaultEvents.on('unlocked', forget)

const signature = (all: KindHit[]) => all.map((h) => `${h.id}\u0001${h.title}`).join('\u0002')

function nearIndex(k: Kind, all: KindHit[], ctx: KindContext): Near {
  const key = `${k.kind}\u0001${ctx.user ? '' : (ctx.agentId ?? '')}`
  const sig = signature(all)
  const known = built.get(key)
  if (known && known.sig === sig) return known
  const index = new MiniSearch<Doc>({
    idField: 'i',
    fields: ['title', 'id'],
    searchOptions: { boost: { title: 2 }, prefix: (term) => term.length > 2, fuzzy: (term) => (term.length > 3 ? 0.2 : false), combineWith: 'OR' }
  })
  index.addAll(all.map((h, i) => ({ i, id: h.id, title: h.title })))
  const near = { sig, all, index }
  built.set(key, near)
  return near
}

export function nearHits(k: Kind, all: KindHit[], text: string, limit: number, ctx: KindContext, accept: (h: KindHit) => boolean = () => true): KindHit[] {
  const { clauses, exclude } = parseQuery(text)
  const terms = clauses.flatMap((c) => c.include).join(' ').trim()
  if (!all.length || !terms || limit <= 0) return []
  const near = nearIndex(k, all, ctx)
  return near.index
    .search(terms)
    .map((r) => near.all[r.id as number])
    .filter((h) => !exclude.some((ex) => `${h.title} ${h.id}`.toLowerCase().includes(ex)))
    .filter(accept)
    .slice(0, limit)
}
