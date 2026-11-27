import { useMemo, useState } from 'react'
import { Check, DoorOpen, Layers, LogIn, LogOut, Plus, Trash2 } from 'lucide-react'
import type { CharacterSheet } from '@shared/types'
import { CHARACTER_TEMPLATES } from '@shared/game/defs'
import { Resource, ensureCharacterDefaults } from '@shared/game/components'
import { GameEntity, createComponent, type Component, type EntityRecord } from '@shared/game/core'
import { Button, EmptyState, ListRow, Modal, Select, StatusBadge, askConfirm } from '../../ui'
import { VitalsPanel } from '../../../game/ui'
import { engine } from '../../../lib/ipc'
import { useBusy } from '../../../lib/useBusy'
import { useLive } from '../../../lib/useLive'
import { failed } from '../../../lib/notify'
import { useGameDefs } from '../useGameDefs'
import { useGameCatalog } from '../useGameCatalog'
import { GenericPanel } from './GenericPanel'
import { panelFor } from './panels'

const MANAGEABLE_COMPONENTS: Array<{ type: string; label: string; note: string }> = [
  { type: 'progression', label: 'Level & XP', note: 'Character level, XP bar, and XP cascading to classes' },
  { type: 'classes', label: 'Classes & Specializations', note: 'Multi-class leveling, conditions, and clutch unlocks' },
  { type: 'traits', label: 'Traits', note: 'Innate passive effects and reactive triggers' },
  { type: 'skills', label: 'Skills', note: 'Skill check ranks and calculated bonuses' },
  { type: 'tags', label: 'Tags', note: 'Keyword identity tags used by rules and conditions' },
  { type: 'stats', label: 'Stats & Attributes', note: 'Base attributes, combat stats, and damage resistances' },
  { type: 'buffs', label: 'Buffs', note: 'Timed status buffs and debuffs' },
  { type: 'abilities', label: 'Abilities & Attacks', note: 'Innate unarmed strikes, spells, and active moves' },
  { type: 'inventory', label: 'Inventory', note: 'Gold, carried stacks, weight, and item bag' },
  { type: 'equipment', label: 'Equipment', note: 'Worn gear and utility belt slots' }
]

const LEFT_TYPES = new Set(['stats', 'skills', 'traits'])
const RIGHT_TYPES = new Set(['classes', 'buffs', 'abilities', 'equipment', 'inventory'])
const HEADER_TYPES = new Set(['progression', 'tags'])

function Join({ sheet, onJoined }: { sheet: CharacterSheet; onJoined: (record: EntityRecord) => void }) {
  const templates = useGameDefs(CHARACTER_TEMPLATES).list ?? []
  const [picked, setPicked] = useState('')
  const [busy, run] = useBusy()
  const template = templates.some((t) => t.id === picked) ? picked : (templates[0]?.id ?? '')
  return (
    <div className="flex flex-col items-start gap-3 p-5">
      <div className="text-[13px] text-dim">
        Joining the game attaches all character components: Stats, Vitals, Level & XP, Classes, Traits, Skills, Tags, Abilities, Inventory, and Equipment.
      </div>
      <div className="flex items-center gap-2">
        <Select value={template} options={templates.map((t) => ({ value: t.id, label: t.name }))} onChange={setPicked} className="w-56" />
        <Button
          variant="primary"
          icon={<LogIn />}
          disabled={!template || busy}
          onClick={() =>
            void run(async () => onJoined(await engine('game.joinCharacter', { sheet: sheet.id, template })), 'Could not add them to the game')
          }
        >
          Join the game
        </Button>
      </div>
    </div>
  )
}

export function CharacterGameTab({ sheet }: { sheet: CharacterSheet }) {
  const [record, setRecord] = useState<EntityRecord | null>(sheet.game ?? null)
  return (
    <>
      {sheet.save && <InSave sheet={sheet} />}
      {record ? <InGame sheet={sheet} record={record} setRecord={setRecord} /> : <Join sheet={sheet} onJoined={setRecord} />}
    </>
  )
}

function InSave({ sheet }: { sheet: CharacterSheet }) {
  const save = useLive(() => engine('saves.get', { id: sheet.save ?? '' }), 'saves.changed')
  const worlds = useLive(() => engine('worlds.list'), 'worlds.changed')
  const world = worlds?.find((w) => w.id === save?.world)
  const takeOut = () =>
    askConfirm(
      `Take ${sheet.title} out of ${save?.name ?? 'the save'}?`,
      'Their game state comes with them onto this sheet, and they leave that world.',
      'Take out',
      () => void engine('saves.takeOut', { sheet: sheet.id }).catch(failed('Could not take them out'))
    )
  return (
    <div className="mx-auto mt-3 flex w-full max-w-[1360px] items-center gap-2 border border-tint-purple/40 bg-tint-purple/[0.05] px-4 py-2 text-[13px]">
      <span className="text-dim">Playing in</span>
      <span className="font-semibold text-ink">{save?.name ?? sheet.save}</span>
      {world && <span className="text-dim">· {world.name}</span>}
      <span className="flex-1" />
      <Button size="sm" variant="ghost" icon={<DoorOpen />} onClick={takeOut}>
        Take out of this save
      </Button>
    </div>
  )
}

function InGame({
  sheet,
  record,
  setRecord
}: {
  sheet: CharacterSheet
  record: EntityRecord
  setRecord: (next: EntityRecord | null) => void
}) {
  const catalog = useGameCatalog()
  const [manageOpen, setManageOpen] = useState(false)

  const entity = useMemo(() => {
    if (!catalog) return null
    const built = GameEntity.fromRecord(record, catalog)
    ensureCharacterDefaults(built)
    return built
  }, [record, catalog])

  if (!catalog || !entity) return <EmptyState title="Loading">One moment.</EmptyState>

  const changed = () => {
    const next = entity.toRecord()
    setRecord(next)
    void engine('game.saveCharacter', { sheet: sheet.id, record: next }).catch(failed('Could not save the character'))
  }

  const leave = () =>
    askConfirm(
      'Take them out of the game?',
      'Their game stats, resources, buffs, spell book, inventory and equipment are removed. The rest of the sheet stays.',
      'Take out',
      () =>
        void engine('game.leaveCharacter', { sheet: sheet.id })
          .then(() => setRecord(null))
          .catch(failed('Could not take them out'))
    )

  const renderPanel = (comp: Component) => {
    const panel = panelFor(comp)
    return panel ? (
      <panel.Panel key={comp.uid} comp={comp} entity={entity} catalog={catalog} changed={changed} />
    ) : (
      <GenericPanel key={comp.uid} comp={comp} />
    )
  }

  const headerComps = entity.comps.filter((c) => HEADER_TYPES.has(c.type))
  const leftComps = entity.comps.filter((c) => LEFT_TYPES.has(c.type))
  const rightComps = entity.comps.filter((c) => RIGHT_TYPES.has(c.type))
  const extraComps = entity.comps.filter(
    (c) => !(c instanceof Resource) && !HEADER_TYPES.has(c.type) && !LEFT_TYPES.has(c.type) && !RIGHT_TYPES.has(c.type)
  )

  return (
    <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-2.5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/40 pb-1.5">
        <div className="flex items-center gap-2 font-label text-[11px] caps-14 text-dim">
          <span>{entity.name}</span>
          <span>·</span>
          <span>{entity.comps.length} components</span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" icon={<Layers />} onClick={() => setManageOpen(true)}>
            Components
          </Button>
          <Button size="sm" variant="ghost" icon={<LogOut />} onClick={leave}>
            Take out of the game
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-2.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="flex flex-col gap-2.5">{headerComps.map(renderPanel)}</div>
        <VitalsPanel entity={entity} catalog={catalog} changed={changed} />
      </div>

      <div className="grid grid-cols-1 items-start gap-2.5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="flex min-w-0 flex-col gap-2.5">{leftComps.map(renderPanel)}</div>
        <div className="flex min-w-0 flex-col gap-2.5">
          {rightComps.map(renderPanel)}
          {extraComps.map(renderPanel)}
        </div>
      </div>

      <Modal open={manageOpen} onClose={() => setManageOpen(false)} title="Character Game Components">
        <div className="flex flex-col">
          {MANAGEABLE_COMPONENTS.map((item) => {
            const attached = entity.comps.find((c) => c.type === item.type)
            return (
              <ListRow
                key={item.type}
                active={Boolean(attached)}
                title={item.label}
                subtitle={item.note}
                meta={<StatusBadge tone={attached ? 'ok' : 'idle'}>{attached ? 'Active' : 'Off'}</StatusBadge>}
                onClick={() => undefined}
                actions={
                  attached ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Trash2 />}
                      onClick={() => {
                        entity.remove(attached)
                        changed()
                      }}
                    >
                      Remove
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="primary"
                      icon={<Plus />}
                      onClick={() => {
                        const created = createComponent({ type: item.type })
                        if (created && entity.add(created)) changed()
                      }}
                    >
                      Add
                    </Button>
                  )
                }
              />
            )
          })}
          {entity.comps.some((c) => c instanceof Resource) ? null : (
            <ListRow
              active={false}
              title="Core Resources (Health / Stamina / Mana)"
              subtitle="Re-attach all missing default character components and vitals"
              meta={<StatusBadge tone="warn">Missing</StatusBadge>}
              onClick={() => undefined}
              actions={
                <Button
                  size="sm"
                  variant="primary"
                  icon={<Check />}
                  onClick={() => {
                    if (ensureCharacterDefaults(entity)) changed()
                  }}
                >
                  Restore defaults
                </Button>
              }
            />
          )}
        </div>
      </Modal>
    </div>
  )
}
