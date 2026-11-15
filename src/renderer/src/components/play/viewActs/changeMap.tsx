import { DoorOpen } from 'lucide-react'
import { Button } from '../../ui'
import { engine } from '../../../lib/ipc'
import { useLive } from '../../../lib/useLive'
import { useBusy } from '../../../lib/useBusy'
import { closePlay, showPlay } from '../playStore'
import { registerViewAct } from './registry'

function GoButton({ map, go }: { map: string; go: () => Promise<unknown> }) {
  const names = useLive(() => engine('maps.list'), 'maps.changed')
  const [busy, run] = useBusy()
  const name = names?.find((m) => m.id === map)?.name ?? map
  return (
    <Button variant="primary" icon={<DoorOpen />} className="self-start" disabled={busy} onClick={() => void run(() => go().then(closePlay), 'Could not go there')}>
      Go to {name}
    </Button>
  )
}

registerViewAct('change_map', (data, { host, title, token }) => {
  const map = String(data.map ?? '')
  if (!map || !token) return
  const go = () => host.goTo(token.visitor.token, map, String(data.place ?? ''))
  if (data.button !== true) return go()
  showPlay(title, <GoButton map={map} go={go} />)
})
