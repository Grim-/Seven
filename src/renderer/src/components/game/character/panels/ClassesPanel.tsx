import { useState } from 'react'
import { Check, Plus, SlidersHorizontal, Trash2, X } from 'lucide-react'
import { CharacterClass, Classes } from '@shared/game/components'
import { CLASS_TEMPLATES } from '@shared/game/defs'
import {
  AlertBox,
  Button,
  CountStepper,
  ListRow,
  Modal,
  RowAction,
  SegmentBar,
  StatusBadge,
  Toggle,
  TraitChips,
  confirmDelete,
  type ShellTrait
} from '../../../ui'
import { BrowsePick, type BrowseOption } from '../../../ui/BrowsePick'
import { GamePanel } from '../../../../game/ui'
import { cn } from '../../../../lib/cn'
import { useGameDefs } from '../../useGameDefs'
import { EffectTokenButton } from '../../effects/EffectTokenButton'
import { registerComponentPanel, type PanelProps } from './registry'

function ClassesPanel({ comp, changed }: PanelProps<Classes>) {
  const defs = useGameDefs(CLASS_TEMPLATES).list ?? []
  const [pickId, setPickId] = useState<string | null>(null)
  const [bypassLock, setBypassLock] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [xpAdd, setXpAdd] = useState<Record<string, number>>({})
  const [inspectId, setInspectId] = useState<string | null>(null)

  const unlockCheck = pickId ? comp.canUnlock(pickId, { bypassConditions: bypassLock }) : null
  const inspected = inspectId ? comp.byId(inspectId) : null
  const inspectedDef = inspected?.def() ?? null

  const classOptions: BrowseOption[] = defs
    .filter((d) => !comp.hasClass(d.id))
    .map((d) => {
      const check = comp.canUnlock(d.id)
      const parent = String(d.values.parentClass || '')
      const group = !check.ok && !bypassLock ? 'Locked' : parent ? 'Specializations' : 'Classes'
      const note = !check.ok && check.reasons.length ? `Requires: ${check.reasons.join('; ')}` : d.notes || undefined
      return { value: d.id, label: parent ? `${d.name} (${parent})` : d.name, group, note }
    })

  return (
    <GamePanel
      title="Classes & Specializations"
      aside={comp.held.length ? `${comp.held.length} held` : 'classless'}
      bodyClassName="gap-2.5 p-3"
    >
      {comp.pendingUnlocks.length > 0 && (
        <div className="flex flex-col border border-accent/50 bg-accent/[0.06]">
          {comp.pendingUnlocks.map((offer) => (
            <ListRow
              key={offer.classId}
              active
              title={`Clutch unlock: ${offer.label}`}
              subtitle={`${offer.signal} — ${offer.prompt}`}
              onClick={() => undefined}
              actions={
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="primary"
                    icon={<Check />}
                    onClick={() => {
                      const res = comp.acceptUnlock(offer.classId)
                      if (!res.ok) setError((res.reasons ?? ['Could not unlock class.']).join('; '))
                      else {
                        setError(null)
                        changed()
                      }
                    }}
                  >
                    Unlock
                  </Button>
                  <RowAction
                    icon={<X />}
                    title="Dismiss"
                    onClick={() => {
                      comp.dismissUnlock(offer.classId)
                      changed()
                    }}
                  />
                </div>
              }
            />
          ))}
        </div>
      )}

      {error && <AlertBox>{error}</AlertBox>}

      {comp.held.length === 0 ? (
        <span className="font-mono text-[11.5px] text-faint">No classes yet — works classless, or add one or more below.</span>
      ) : (
        <div className="flex flex-col gap-1.5">
          {comp.held.map((cls: CharacterClass) => {
            const def = cls.def()
            const restrictions = cls.restrictionReasons()
            const restricted = restrictions.length > 0
            const needed = cls.xpNeeded()
            const ratio = Math.min(1, Math.max(0, cls.xp / Math.max(1, needed)))
            const amount = xpAdd[cls.id] ?? 50
            const tags: ShellTrait[] = [
              ...(def?.parentClass ? [{ key: 'parent', label: def.parentClass, tone: 'busy' as const }] : []),
              ...cls.grantedTags().map((t) => ({ key: `tag:${t}`, label: t, tone: 'idle' as const }))
            ]

            return (
              <div
                key={cls.uid}
                className={cn(
                  'flex flex-col gap-1.5 border bg-black/55 px-2.5 py-2',
                  restricted ? 'border-warn/50 shadow-[inset_2px_0_0_var(--color-warn)]' : 'border-line/50 shadow-[inset_2px_0_0_var(--color-accent)]'
                )}
              >
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                  <div className="flex min-w-[9rem] flex-1 items-center gap-2">
                    <span className="truncate font-semibold text-white" title={def?.description || cls.title}>
                      {cls.title}
                    </span>
                    <StatusBadge tone={restricted ? 'warn' : 'ok'}>{restricted ? 'Restricted' : 'Active'}</StatusBadge>
                    {tags.length > 0 && <TraitChips traits={tags} />}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[10px] uppercase text-faint">Lv</span>
                    <CountStepper
                      small
                      value={cls.level}
                      min={1}
                      max={999}
                      onChange={(next) => {
                        cls.setLevel(next)
                        comp.refreshRestrictions()
                        changed()
                      }}
                    />
                  </div>

                  <div className="flex min-w-[10rem] flex-[1_1_10rem] items-center gap-2">
                    <SegmentBar value={ratio} segments={14} thin className="flex-1" />
                    <span className="shrink-0 font-mono text-[11px] tabular-nums text-dim">
                      {cls.xp}/{needed}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 [--tone:var(--color-accent)]">
                    <EffectTokenButton
                      name="xp"
                      spec={{ kind: 'number', default: 50, min: 1, description: `XP to grant directly to ${cls.title}.` }}
                      value={amount}
                      onChange={(v) => setXpAdd((m) => ({ ...m, [cls.id]: Math.max(1, Number(v || 50)) }))}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Plus />}
                      title={`Grant ${amount} XP to ${cls.title}`}
                      onClick={() => {
                        cls.grantXp(amount, 'manual_class')
                        comp.refreshRestrictions()
                        changed()
                      }}
                    >
                      XP
                    </Button>
                    <RowAction icon={<SlidersHorizontal />} title="View milestones" onClick={() => setInspectId(cls.id)} />
                    <RowAction
                      danger
                      icon={<Trash2 />}
                      title="Permanently lose class"
                      onClick={() =>
                        confirmDelete(
                          `Lose ${cls.title}?`,
                          `Permanently remove ${cls.title}? Non-permanent stats, skills, traits, and abilities from this class will be removed.`,
                          async () => {
                            comp.loseClass(cls.id, 'user_removed')
                            changed()
                          },
                          undefined,
                          'Remove Class'
                        )
                      }
                    />
                  </div>
                </div>

                {restricted && (
                  <div className="border-t border-warn/30 pt-1 font-mono text-[11px] text-warn">
                    Restricted: {restrictions.join('; ')}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {classOptions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line/35 pt-2">
          <BrowsePick
            value={pickId}
            options={classOptions}
            placeholder="Pick a class or specialization…"
            onChange={(id) => {
              setPickId(id)
              setError(null)
            }}
            className="min-w-[14rem] flex-1"
          />
          <Toggle checked={bypassLock} onChange={setBypassLock} label="Override requirements" />
          <Button
            size="sm"
            variant="primary"
            disabled={!pickId || !unlockCheck?.ok}
            icon={<Plus />}
            onClick={() => {
              if (!pickId) return
              const res = comp.grantClass(pickId, { bypassConditions: bypassLock, reason: 'sheet_add' })
              if (!res.ok) {
                setError((res.reasons ?? ['Requirements not met.']).join('; '))
                return
              }
              setPickId(null)
              setError(null)
              changed()
            }}
          >
            Gain Class
          </Button>
        </div>
      )}

      <Modal open={Boolean(inspected && inspectedDef)} onClose={() => setInspectId(null)} title={inspected ? `${inspected.title} Milestones` : ''}>
        {inspected && inspectedDef && (
          <div className="flex flex-col">
            {inspectedDef.rewards.length === 0 ? (
              <p className="text-[12.5px] text-dim">No milestone rewards configured on this class yet.</p>
            ) : (
              inspectedDef.rewards.map((r) => {
                const earned = inspected.level >= r.level
                return (
                  <ListRow
                    key={r.level}
                    active={earned}
                    title={`Level ${r.level}${r.permanent ? ' · Permanent' : ''}`}
                    subtitle={r.summary || 'Class milestone'}
                    meta={<StatusBadge tone={earned ? 'ok' : 'idle'}>{earned ? 'Earned' : 'Locked'}</StatusBadge>}
                    onClick={() => undefined}
                  />
                )
              })
            )}
          </div>
        )}
      </Modal>
    </GamePanel>
  )
}

registerComponentPanel(Classes.type, { Panel: ClassesPanel })
