import { Minus, Play } from 'lucide-react'
import { Inventory } from '@shared/game/components'
import { ITEM_TEMPLATES } from '@shared/game/defs'
import { Button, NumberField, Select } from '../../../ui'
import { toast } from '../../../../store/toasts'
import { Section } from '../../../data/sheet/dnd/Section'
import { useGameDefs } from '../../useGameDefs'
import { registerComponentPanel, type PanelProps } from './registry'

function InventoryPanel({ comp, entity, catalog, changed }: PanelProps<Inventory>) {
  const defs = useGameDefs(ITEM_TEMPLATES).list ?? []
  const weight = comp.items.reduce((sum, i) => sum + Number(i.params.weight) * i.count, 0)
  return (
    <Section title="Inventory" aside={`${comp.items.length} of ${String(comp.params.slots)} stacks · ${Math.round(weight * 10) / 10} lb`}>
      <div className="flex items-center gap-2 text-[13px]">
        <span className="flex-1 text-dim">Gold</span>
        <NumberField
          value={comp.gold}
          min={0}
          onChange={(v) => {
            comp.changeGold((v ?? comp.gold) - comp.gold)
            changed()
          }}
          className="h-7 w-24 text-[12.5px]"
        />
      </div>
      {comp.items.map((item) => (
        <div key={item.uid} className="flex items-center gap-2 text-[13px]">
          <span className="min-w-0 flex-1 truncate text-white/90">{String(item.params.label || item.id)}</span>
          <span className="font-mono text-[11.5px] text-dim">×{item.count}</span>
          {item.usable() && (
            <Button
              size="sm"
              variant="ghost"
              icon={<Play />}
              title="Use"
              onClick={() => {
                const done = item.use({ user: entity, target: entity, distance: 0 } as never)
                if (done !== true) toast.error('Could not use it', done)
                changed()
              }}
            />
          )}
          <Button
            size="sm"
            variant="ghost"
            icon={<Minus />}
            title="Drop one"
            onClick={() => {
              comp.take(item, 1)
              changed()
            }}
          />
        </div>
      ))}
      <Select
        value=""
        options={[{ value: '', label: 'Give an item…' }, ...defs.map((d) => ({ value: d.id, label: d.name }))]}
        onChange={(id) => {
          const def = id ? catalog.template(ITEM_TEMPLATES, id) : null
          if (!def) return
          if (comp.give(def, 1) < 1) toast.error('No room', 'The inventory is full.')
          changed()
        }}
        className="h-8 text-[12.5px]"
      />
    </Section>
  )
}

registerComponentPanel(Inventory.type, { Panel: InventoryPanel })
