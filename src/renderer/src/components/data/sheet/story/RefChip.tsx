import type { MenuItem } from '../../../ui'
import { Chip } from '../../../chat/References'

export function RefChip({ kind, ref: id, count, menu }: { kind: string; ref: string; label?: string; count?: number; menu?: MenuItem[] }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Chip kind={kind} refText={id} menu={menu} />
      {count !== undefined && <span className="font-ui text-[10.5px] text-faint">{count}</span>}
    </span>
  )
}
