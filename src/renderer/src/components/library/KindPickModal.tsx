import { Modal } from '../ui'
import { useLibrary } from '../../lib/library'
import { KindPicker } from './KindPicker'
import { kindUi } from '../../registries/kinds'

export function KindPickModal({ kind, title, onPick, onClose }: { kind: string; title: string; onPick: (kind: string, id: string) => void; onClose: () => void }) {
  const { sections } = useLibrary('', 1)
  const section = sections?.find((s) => s.kind === kind) ?? null
  const Picker = kindUi(kind).picker ?? KindPicker
  return (
    <Modal open wide title={title} onClose={onClose} bodyClassName="flex h-[70vh] min-h-0 flex-col p-3">
      {section ? <Picker section={section} onPick={onPick} /> : <div className="font-ui text-[11px] text-dim">Loading…</div>}
    </Modal>
  )
}
