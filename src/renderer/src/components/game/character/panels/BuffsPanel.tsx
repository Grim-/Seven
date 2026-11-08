import { X } from 'lucide-react'
import { Buffs } from '@shared/game/components'
import { BUFF_TEMPLATES } from '@shared/game/defs'
import { Button, Select } from '../../../ui'
import { Section } from '../../../data/sheet/dnd/Section'
import { useGameDefs } from '../../useGameDefs'
import { gameTime } from './time'
import { registerComponentPanel, type PanelProps } from './registry'

function BuffsPanel({ comp, catalog, changed }: PanelProps<Buffs>) {
  const defs = useGameDefs(BUFF_TEMPLATES).list ?? []
  const name = (id: string) => defs.find((d) => d.id === id)?.name ?? id
  return (
    <Section title="Buffs" aside={comp.held.length ? undefined : 'none'}>
      {comp.held.map((b) => (
        <div key={b.uid} className="flex items-center gap-2 text-[13px]">
          <span className="min-w-0 flex-1 truncate text-white/90">
            {name(b.id)}
            {b.stacks > 1 && <span className="ml-1.5 font-mono text-[11.5px] text-accent">×{b.stacks}</span>}
          </span>
          <span className="font-mono text-[11.5px] text-dim">{gameTime(b.remaining)}</span>
          <Button
            size="sm"
            variant="ghost"
            icon={<X />}
            title="Remove"
            onClick={() => {
              comp.removeBuff(b)
              changed()
            }}
          />
        </div>
      ))}
      <Select
        value=""
        options={[{ value: '', label: 'Add a buff…' }, ...defs.map((d) => ({ value: d.id, label: d.name }))]}
        onChange={(id) => {
          const def = id ? catalog.template(BUFF_TEMPLATES, id) : null
          if (def && comp.apply(def, null)) changed()
        }}
        className="h-8 text-[12.5px]"
      />
    </Section>
  )
}

registerComponentPanel(Buffs.type, { Panel: BuffsPanel })
