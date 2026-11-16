import { useState } from 'react'
import { RotateCcw, SlidersHorizontal, X } from 'lucide-react'
import { Trait, Traits } from '@shared/game/components'
import { createComponent, type Component, type ComponentDef } from '@shared/game/core'
import { TRAIT_TEMPLATES } from '@shared/game/defs'
import { ListRow, Modal, RowAction, StatusBadge, TraitChips, type ShellTrait } from '../../../ui'
import { BrowsePick, type BrowseOption } from '../../../ui/BrowsePick'
import { GamePanel } from '../../../../game/ui'
import { useGameDefs } from '../../useGameDefs'
import { ParamTokens } from '../../ParamTokens'
import { PartsEditor } from '../../parts/PartsEditor'
import { registerComponentPanel, type PanelProps } from './registry'

function toDef(c: Component): ComponentDef {
  return { type: c.type, ...c.params, comps: c.comps.map(toDef) }
}

function statusMeta(trait: Trait): { label: string; tone: 'ok' | 'busy' | 'warn' } {
  if (trait.exhausted) return { label: 'exhausted', tone: 'warn' }
  if (trait.cooldownLeft > 0) return { label: `${Math.ceil(trait.cooldownLeft)} s`, tone: 'busy' }
  if (!trait.isActive()) return { label: 'inactive', tone: 'warn' }
  const sig = String(trait.params.signal || '')
  return { label: sig ? sig : 'passive', tone: 'ok' }
}

function TraitsPanel({ comp, catalog, changed }: PanelProps<Traits>) {
  const [configuring, setConfiguring] = useState<string | null>(null)
  const defs = useGameDefs(TRAIT_TEMPLATES).list ?? []
  const configured = configuring ? comp.held.find((t) => t.uid === configuring) ?? null : null
  const nameOf = (trait: Trait) => defs.find((d) => d.id === trait.id)?.name ?? trait.title
  const noteOf = (trait: Trait) => defs.find((d) => d.id === trait.id)?.notes ?? String(trait.params.description || '')

  const available: BrowseOption[] = defs
    .filter((d) => !comp.has(d.id))
    .map((d) => ({
      value: d.id,
      label: d.name,
      group: d.values.signal ? 'Reactive' : 'Passive',
      note: d.notes || undefined
    }))

  return (
    <GamePanel
      title="Traits"
      aside={comp.held.length ? `${comp.held.length} passive` : 'none'}
      action={
        available.length > 0 ? (
          <BrowsePick
            value={null}
            options={available}
            placeholder="+ Add trait"
            onChange={(id) => {
              const tpl = id ? catalog.template(TRAIT_TEMPLATES, id) : null
              if (tpl && id && comp.grant({ ...tpl, id })) changed()
            }}
            className="min-w-[9rem]"
          />
        ) : undefined
      }
      bodyClassName="p-3"
    >
      {comp.held.length === 0 ? (
        <span className="font-mono text-[11.5px] text-faint">No innate traits or reactive passives yet.</span>
      ) : (
        <div className="flex flex-col border-y border-line/40">
          {comp.held.map((t) => {
            const st = statusMeta(t)
            const chips: ShellTrait[] = [
              ...(t.sourceClass ? [{ key: 'src', label: t.sourceClass, tone: 'busy' as const }] : []),
              ...(t.isPermanent ? [{ key: 'perm', label: 'permanent', tone: 'ok' as const }] : [])
            ]
            return (
              <ListRow
                key={t.uid}
                active={st.tone === 'ok'}
                title={nameOf(t)}
                subtitle={noteOf(t) || undefined}
                meta={
                  <span className="flex items-center gap-1.5">
                    <TraitChips traits={chips} />
                    <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                  </span>
                }
                onClick={() => setConfiguring(t.uid)}
                actions={
                  <>
                    {(t.exhausted || t.cooldownLeft > 0 || t.uses > 0) && (
                      <RowAction
                        icon={<RotateCcw />}
                        title="Reset cooldown & uses"
                        onClick={() => {
                          t.resetUsage()
                          changed()
                        }}
                      />
                    )}
                    <RowAction icon={<SlidersHorizontal />} title="Configure trait" onClick={() => setConfiguring(t.uid)} />
                    <RowAction
                      danger
                      icon={<X />}
                      title="Remove trait"
                      onClick={() => {
                        comp.removeTrait(t)
                        changed()
                      }}
                    />
                  </>
                }
              />
            )
          })}
        </div>
      )}

      <Modal open={Boolean(configured)} onClose={() => setConfiguring(null)} title={configured ? `Configure: ${nameOf(configured)}` : ''} wide>
        {configured && (
          <div className="flex flex-col gap-4">
            <ParamTokens
              schema={Trait.PARAMS}
              values={configured.params}
              onChange={(next) => {
                Object.assign(configured.params, next)
                changed()
              }}
              title="Trait Settings"
            />
            <PartsEditor
              host={Trait.type}
              value={configured.comps.map(toDef)}
              onChange={(defs) => {
                for (const old of [...configured.comps]) configured.remove(old)
                for (const def of defs) {
                  const child = createComponent(def)
                  if (child) configured.add(child)
                }
                changed()
              }}
            />
          </div>
        )}
      </Modal>
    </GamePanel>
  )
}

registerComponentPanel(Traits.type, { Panel: TraitsPanel })
