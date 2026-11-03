import { Modal } from '../ui'
import { PadExplorer } from './PadExplorer'
import type { Pad } from './pad'

export function PadPicker({ id, pad, open, onClose }: { id: string; pad: Pad; open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} title="Add to the paper" onClose={onClose} wide>
      <div className="flex h-[70vh] min-h-0">
        <PadExplorer id={id} pad={pad} onAdded={onClose} />
      </div>
    </Modal>
  )
}
