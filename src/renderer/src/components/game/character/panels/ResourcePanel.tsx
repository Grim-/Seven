import { Resource } from '@shared/game/components'
import { signalLabel } from '@shared/game/core'
import { NumberField } from '../../../ui'
import { Section } from '../../../data/sheet/dnd/Section'
import { barColour } from '../../ResourceBars'
import { registerComponentPanel, type PanelProps } from './registry'

function ResourcePanel({ comp, catalog, changed }: PanelProps<Resource>) {
  const def = catalog.stat(comp.stat)
  const max = comp.max()
  const now = comp.get()
  const part = max > 0 ? now / max : 0
  const refills = (def?.refill.on ?? []).map(signalLabel).join(', ')
  return (
    <Section title={def?.label ?? comp.stat} aside={refills || undefined}>
      <div className="flex items-center gap-3">
        <div className="h-2.5 flex-1 border border-line/40 tone-panel-60">
          <div className="h-full transition-[width]" style={{ width: `${Math.round(part * 100)}%`, background: barColour(def?.colour ?? null) }} />
        </div>
        <NumberField
          value={Math.round(now * 100) / 100}
          min={0}
          max={max}
          onChange={(v) => {
            comp.set(v ?? now)
            changed()
          }}
          className="h-7 w-20 text-[12.5px]"
        />
        <span className="font-ui text-[12.5px] text-dim">/ {Math.round(max)}</span>
      </div>
    </Section>
  )
}

registerComponentPanel(Resource.type, { Panel: ResourcePanel })
