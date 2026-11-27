import { Trash2 } from 'lucide-react'
import { useResolvedRef } from '../../../entries/useResolvedRef'
import { LinkFix } from '../../LinkFix'
import { RefChip } from './RefChip'

export function MentionChip({ kind, ref: id, count, onRelink }: { kind: string; ref: string; count?: number; onRelink?: (kind: string, ref: string, to: string) => void }) {
  const { missing } = useResolvedRef(kind, id)
  const remove = onRelink ? () => onRelink(kind, id, '') : null
  return (
    <span className="inline-flex items-center gap-1">
      <RefChip kind={kind} ref={id} count={count} menu={remove ? [{ label: 'Remove', icon: <Trash2 />, danger: true, onSelect: remove }] : []} />
      {missing && onRelink && remove && <LinkFix link={`@${kind}:${id}`} onFix={(to) => onRelink(kind, id, to)} onRemove={remove} />}
    </span>
  )
}
