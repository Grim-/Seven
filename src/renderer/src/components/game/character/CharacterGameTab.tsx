import { useMemo, useState } from 'react'
import { DoorOpen, LogIn, LogOut } from 'lucide-react'
import type { CharacterSheet } from '@shared/types'
import { CHARACTER_TEMPLATES } from '@shared/game/defs'
import { GameEntity, type EntityRecord } from '@shared/game/core'
import { Button, EmptyState, Select, askConfirm } from '../../ui'
import { engine } from '../../../lib/ipc'
import { useBusy } from '../../../lib/useBusy'
import { useLive } from '../../../lib/useLive'
import { failed } from '../../../lib/notify'
import { cn } from '../../../lib/cn'
import { useGameDefs } from '../useGameDefs'
import { useGameCatalog } from '../useGameCatalog'
import { RuleSetProvider, useResolvedRuleSet, useRuleSets } from '../ruleSet'
import { GenericPanel } from './GenericPanel'
import { panelFor } from './panels'

function Join({ sheet, onJoined }: { sheet: CharacterSheet; onJoined: (record: EntityRecord, ruleSet: string) => void }) {
  const sets = useRuleSets() ?? []
  const [chosen, setChosen] = useState('')
  const ruleSet = sheet.save ? (sheet.gameRules ?? '') || sets[0]?.id || '' : chosen || sets[0]?.id || ''
  const templates = useGameDefs(CHARACTER_TEMPLATES, ruleSet || null).list ?? []
  const [picked, setPicked] = useState('')
  const [busy, run] = useBusy()
  const template = templates.some((t) => t.id === picked) ? picked : (templates[0]?.id ?? '')
  return (
    <div className="flex flex-col items-start gap-3 p-5">
      <div className="text-[13px] text-dim">This character isn't in the game yet. Joining gives them the stats, Health, Stamina, Mana, buffs, spell book, inventory and equipment of a character template.</div>
      <div className="flex items-center gap-2">
        {!sheet.save && <Select value={ruleSet} options={sets.map((s) => ({ value: s.id, label: s.name }))} onChange={setChosen} className="w-48" />}
        <Select value={template} options={templates.map((t) => ({ value: t.id, label: t.name }))} onChange={setPicked} className="w-56" />
        <Button variant="primary" icon={<LogIn />} disabled={!template || busy} onClick={() => void run(async () => onJoined(await engine('game.joinCharacter', { sheet: sheet.id, ruleSet, template }), ruleSet), 'Could not add them to the game')}>
          Join the game
        </Button>
      </div>
    </div>
  )
}

export function CharacterGameTab({ sheet }: { sheet: CharacterSheet }) {
  const [rules, setRules] = useState(sheet.gameRules ?? '')
  const ruleSet = useResolvedRuleSet(rules)
  const [record, setRecord] = useState<EntityRecord | null>(sheet.game ?? null)
  const joined = (next: EntityRecord, set: string) => {
    setRules(set)
    setRecord(next)
  }
  return (
    <RuleSetProvider ruleSet={ruleSet}>
      {sheet.save && <InSave sheet={sheet} />}
      {record ? <InGame sheet={sheet} record={record} setRecord={setRecord} /> : <Join sheet={sheet} onJoined={joined} />}
    </RuleSetProvider>
  )
}

function InSave({ sheet }: { sheet: CharacterSheet }) {
  const save = useLive(() => engine('saves.get', { id: sheet.save ?? '' }), 'saves.changed')
  const worlds = useLive(() => engine('worlds.list'), 'worlds.changed')
  const world = worlds?.find((w) => w.id === save?.world)
  const takeOut = () =>
    askConfirm(`Take ${sheet.title} out of ${save?.name ?? 'the save'}?`, 'Their game state comes with them onto this sheet, and they leave that world.', 'Take out', () => void engine('saves.takeOut', { sheet: sheet.id }).catch(failed('Could not take them out')))
  return (
    <div className="mx-auto mt-4 flex w-full max-w-[1240px] items-center gap-2 border border-purple/40 bg-purple/[0.05] px-4 py-2.5 text-[13px]">
      <span className="text-dim">Playing in</span>
      <span className="font-semibold text-white">{save?.name ?? sheet.save}</span>
      {world && <span className="text-dim">· {world.name}</span>}
      <span className="flex-1" />
      <Button size="sm" variant="ghost" icon={<DoorOpen />} onClick={takeOut}>
        Take out of this save
      </Button>
    </div>
  )
}

function InGame({ sheet, record, setRecord }: { sheet: CharacterSheet; record: EntityRecord; setRecord: (next: EntityRecord | null) => void }) {
  const catalog = useGameCatalog()
  const entity = useMemo(() => (catalog ? GameEntity.fromRecord(record, catalog) : null), [record, catalog])
  if (!catalog || !entity) return <EmptyState title="Loading">One moment.</EmptyState>
  const changed = () => {
    const next = entity.toRecord()
    setRecord(next)
    void engine('game.saveCharacter', { sheet: sheet.id, record: next }).catch(failed('Could not save the character'))
  }
  const leave = () =>
    askConfirm('Take them out of the game?', 'Their game stats, resources, buffs, spell book, inventory and equipment are removed. The rest of the sheet stays.', 'Take out', () =>
      void engine('game.leaveCharacter', { sheet: sheet.id })
        .then(() => setRecord(null))
        .catch(failed('Could not take them out'))
    )
  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-2.5 p-4">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(22rem,1fr))] items-start gap-2.5">
        {entity.comps.map((comp) => {
          const panel = panelFor(comp)
          return (
            <div key={comp.uid} className={cn(panel?.wide && 'col-span-full')}>
              {panel ? <panel.Panel comp={comp} entity={entity} catalog={catalog} changed={changed} /> : <GenericPanel comp={comp} />}
            </div>
          )
        })}
      </div>
      <Button size="sm" variant="ghost" icon={<LogOut />} className="self-start" onClick={leave}>
        Take out of the game
      </Button>
    </div>
  )
}
