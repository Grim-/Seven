import { Modal } from '../ui'
import { closePlay, usePlay } from './playStore'

export function PlayHost() {
  const view = usePlay((s) => s.view)
  return (
    <Modal open={view !== null} title={view?.title ?? ''} onClose={closePlay}>
      {view?.node}
    </Modal>
  )
}
