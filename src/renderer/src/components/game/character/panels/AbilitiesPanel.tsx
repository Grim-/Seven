import { useState } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import { Abilities, hasWieldedWeapon } from '@shared/game/components'
import { createComponent, type Component, type ComponentDef } from '@shared/game/core'
import { ABILITY_TEMPLATES } from '@shared/game/defs'
import { Button, Modal, StatusBadge } from '../../../ui'
import { BrowsePick, type BrowseOption } from '../../../ui/BrowsePick'
import { hideTip, showTip } from '../../../ui/TooltipHost'
import { GamePanel, RowList, getGameVisual } from '../../../../game/ui'
import { cn } from '../../../../lib/cn'
import { useGameDefs } from '../../useGameDefs'
import { PartsEditor } from '../../parts/PartsEditor'
import { registerComponentPanel, type PanelProps } from './registry'

function toDef(c: Component): ComponentDef {
  return { type: c.type, ...c.params, comps: c.comps.map(toDef) }
}

function AbilitiesPanel({ comp, entity, catalog, changed }: PanelProps<Abilities>) {
  const defs = useGameDefs(ABILITY_TEMPLATES).list ?? []
  const free = defs.filter((d) => !comp.find(d.id))
  const armed = hasWieldedWeapon(entity)
  const [editing, setEditing] = useState<ComponentDef[] | null>(null)

  const openEditor = () => setEditing(comp.known.map(toDef))

  const saveEditor = () => {
    if (!editing) return
    for (const old of [...comp.comps]) comp.remove(old)
    for (const def of editing) {
      const made = createComponent(def)
      if (made) comp.add(made)
    }
    setEditing(null)
    changed()
  }

  const presetOptions: BrowseOption[] = free.map((d) => ({
    value: d.id,
    label: d.name,
    group: d.values.unarmedOnly ? 'Unarmed' : 'Presets',
    note: d.notes || undefined
  }))

  return (
    <GamePanel
      title="Abilities & Attacks"
      aside={comp.known.length ? `${comp.known.length} known` : 'none'}
      action={
        <div className="flex items-center gap-1.5">
          {presetOptions.length > 0 && (
            <BrowsePick
              value={null}
              options={presetOptions}
              placeholder="+ Learn preset"
              onChange={(id) => {
                const def = id ? catalog.template(ABILITY_TEMPLATES, id) : null
                const made = def ? createComponent(def) : null
                if (made && comp.add(made)) changed()
              }}
              className="min-w-[9.5rem]"
            />
          )}
          <Button size="sm" variant="secondary" icon={<SlidersHorizontal />} onClick={openEditor}>
            Configure
          </Button>
        </div>
      }
      bodyClassName="p-2.5"
    >
      {comp.known.length === 0 ? (
        <span className="font-ui text-[11.5px] text-faint">No innate attacks or abilities learned yet.</span>
      ) : (
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {comp.known.map((a) => {
            const label = String(a.params.label || a.id)
            const cost = Object.entries(a.cost)
              .map(([stat, n]) => `${n} ${catalog.stat(stat)?.label ?? stat}`)
              .join(', ')
            const rows = a.comps.flatMap((c) => c.tooltipRows())
            const damageHint = rows.find((r) => /damage|heal/i.test(r.label))?.value ?? ''
            const visual = getGameVisual(label, `${damageHint} ${rows.map((r) => r.value).join(' ')}`, 'ability')
            const Icon = visual.Icon
            const suppressed = Boolean(a.params.unarmedOnly) && armed
            const srcClass = String(a.params.sourceClass || '')
            const classSuppressed = Boolean(srcClass && !a.available() && !suppressed)
            const range = Number(a.params.range || 0)

            return (
              <div
                key={a.uid}
                onMouseEnter={(e) =>
                  showTip(
                    e.currentTarget,
                    label,
                    <div className="flex flex-col gap-1.5">
                      <span className="font-ui text-[10.5px] text-dim">
                        {cost || 'Free action'}
                        {range > 0 ? ` · Reach ${range} ft` : ''}
                      </span>
                      <RowList rows={rows} />
                    </div>,
                    'top'
                  )
                }
                onMouseLeave={() => hideTip('component')}
                className={cn(
                  'group flex items-start gap-2 border tone-panel-40 p-2 transition-colors',
                  suppressed || classSuppressed ? 'border-line/30 opacity-60' : 'border-line/45 hover:border-tint-cyan/60'
                )}
              >
                <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', visual.color)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[12.5px] font-semibold text-ink">{label}</span>
                    {srcClass && (
                      <StatusBadge tone={classSuppressed ? 'warn' : 'idle'}>{srcClass}</StatusBadge>
                    )}
                    {Boolean(a.params.unarmedOnly) && (
                      <StatusBadge tone={suppressed ? 'warn' : 'idle'}>
                        {suppressed ? 'armed' : 'unarmed'}
                      </StatusBadge>
                    )}
                  </div>
                  <div className="mt-0.5 truncate font-ui text-[11px] text-dim">
                    {rows.map((r) => r.value).slice(0, 2).join(' · ') || 'Custom action'}
                    {' · '}
                    <span className="text-ink/75">{cost || 'Free'}</span>
                    {range > 0 ? ` · ${range} ft` : ''}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<X />}
                  title="Forget ability"
                  onClick={() => {
                    hideTip('component')
                    comp.remove(a)
                    changed()
                  }}
                />
              </div>
            )
          })}
        </div>
      )}

      {editing && (
        <Modal
          open
          wide
          title="Configure innate abilities & attacks"
          onClose={() => setEditing(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={saveEditor}>
                Save
              </Button>
            </>
          }
        >
          <PartsEditor host="abilities" value={editing} onChange={setEditing} />
        </Modal>
      )}
    </GamePanel>
  )
}

registerComponentPanel(Abilities.type, { Panel: AbilitiesPanel })
