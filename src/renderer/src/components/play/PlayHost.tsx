import { Modal } from '../ui'
import { closePlay, usePlay } from './playStore'

export function PlayHost() {
  const view = usePlay((s) => s.view)
  return (
    <Modal open={view !== null} title={view?.title ?? ''} onClose={closePlay} wide={view?.wide} bodyClassName="min-h-0 max-h-[84vh] overflow-y-auto p-5">
      {view?.node}
    </Modal>
  )
}
