import { Select, SettingRow } from '../../ui'
import type { useProjector } from '../useProjector'

export function ProjectorField({ projector }: { projector: ReturnType<typeof useProjector> }) {
  const { state } = projector
  if (!state) return null
  const options = [{ value: '', label: 'None' }, ...state.options.map((p) => ({ value: p.id, label: p.name }))]
  const pick = (v: string) => projector.pick(v || null)
  return (
    <SettingRow label="Vision adapter" hint={`The mmproj file that lets this model see images. llama-server only; it reloads the model on the next message.${state.auto ? ' Picked from the same folder as the model.' : ''}`}>
      <Select value={state.choice ?? ''} options={options} onChange={pick} className="h-7 w-72 text-[12px]" />
    </SettingRow>
  )
}

