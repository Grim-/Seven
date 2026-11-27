import { BrowsePick } from '../../ui/BrowsePick'
import { engine } from '../../../lib/ipc'
import { useLive } from '../../../lib/useLive'
import { eventLink } from '@shared/game/worldEvents'
import { registerParamEditor, type ParamEditorProps } from './registry'

function WorldEventPick({ value, onChange }: ParamEditorProps) {
  const events = useLive(() => engine('worldEvents.list', {}), 'worldEvents.changed') ?? []
  const worlds = useLive(() => engine('worlds.list'), 'worlds.changed') ?? []
  const options = events
    .filter((e) => e.worldId)
    .map((e) => ({ value: eventLink(e.worldId, e.id), label: e.title, group: worlds.find((w) => w.id === e.worldId)?.name ?? e.worldId, note: e.status }))
  return <BrowsePick value={typeof value === 'string' && value ? value : null} options={options} placeholder="Pick a world event" onChange={(v) => onChange(v ?? '')} />
}

registerParamEditor('worldEvent', { Editor: WorldEventPick })
