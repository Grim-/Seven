import { X } from 'lucide-react'
import { Abilities } from '@shared/game/components'
import { createComponent } from '@shared/game/core'
import { ABILITY_TEMPLATES } from '@shared/game/defs'
import { Button, Select } from '../../../ui'
import { Section } from '../../../data/sheet/dnd/Section'
import { useGameDefs } from '../../useGameDefs'
import { gameTime } from './time'
import { registerComponentPanel, type PanelProps } from './registry'

function AbilitiesPanel({ comp, catalog, changed }: PanelProps<Abilities>) {
  const defs = useGameDefs(ABILITY_TEMPLATES).list ?? []
  const free = defs.filter((d) => !comp.find(d.id))
  return (
    <Section title="Spell book" aside={comp.known.length ? undefined : 'nothing learned'}>
      {comp.known.map((a) => {
        const cost = Object.entries(a.cost)
          .map(([stat, n]) => `${n} ${catalog.stat(stat)?.label ?? stat}`)
          .join(', ')
        return (
          <div key={a.uid} className="flex items-center gap-2 text-[13px]">
            <span className="min-w-0 flex-1 truncate text-white/90">{String(a.params.label || a.id)}</span>
            <span className="font-mono text-[11.5px] text-dim">{a.cooling > 0 ? `ready in ${gameTime(a.cooling)}` : cost || 'free'}</span>
            <Button
              size="sm"
              variant="ghost"
              icon={<X />}
              title="Forget"
              onClick={() => {
                comp.remove(a)
                changed()
              }}
            />
          </div>
        )
      })}
      {free.length > 0 && (
        <Select
          value=""
          options={[{ value: '', label: 'Learn…' }, ...free.map((d) => ({ value: d.id, label: d.name }))]}
          onChange={(id) => {
            const def = id ? catalog.template(ABILITY_TEMPLATES, id) : null
            const made = def ? createComponent(def) : null
            if (made && comp.add(made)) changed()
          }}
          className="h-8 text-[12.5px]"
        />
      )}
    </Section>
  )
}

registerComponentPanel(Abilities.type, { Panel: AbilitiesPanel })
