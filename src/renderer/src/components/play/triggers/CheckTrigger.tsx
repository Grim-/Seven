import { useMemo, useState } from 'react'
import { Dices, X } from 'lucide-react'
import { GameEntity, spawn, type Catalog, type CheckDef } from '@shared/game/core'
import { CREATURE_TEMPLATES } from '@shared/game/defs'
import { checkBonus, checkText, contest, rollCheck, rollLine, type CheckResult, type CheckRoll } from '@shared/game/rules'
import { rollDie } from '@shared/storyRolls'
import { signed } from '@shared/dnd'
import { showName } from '@shared/ids'
import type { PlaceVisitor } from '@shared/maps'
import { ActionBar, Button, Field, FieldGrid, Input, Select } from '../../ui'
import { Markdown } from '../../chat/Markdown'
import { engine } from '../../../lib/ipc'
import { failed } from '../../../lib/notify'
import { toast } from '../../../store/toasts'
import { ItemReward } from '../ItemReward'
import { RollTally, type TallyLine } from '../roll/RollTally'
import { RollVerdict } from '../roll/RollVerdict'
import { WhoRolls, type Roller } from '../roll/WhoRolls'
import { closePlay, worldWhere } from '../playStore'
import { playOutItem } from '../playOut'
import { FlagSelect } from '../../game/FlagSelect'
import { ItemSelect } from '../../game/ItemSelect'
import { useGameDefs } from '../../game/useGameDefs'
import { registerTriggerUi, type TriggerPanelProps, type TriggerEditorProps } from './registry'

const ROLL_MS = 700

interface Opponent {
  name: string
  entity: GameEntity
  check: CheckDef
}

function bonusOf(entity: GameEntity | undefined, check: CheckDef | null): number | null {
  if (!entity || !check) return null
  try {
    return checkBonus(entity, check)
  } catch {
    return null
  }
}

function useOpponent(catalog: Catalog | null, versus: boolean, creature: string, creatureCheck: string, check: CheckDef | null): Opponent | null {
  return useMemo(() => {
    if (!catalog || !versus) return null
    const template = catalog.entity(CREATURE_TEMPLATES, creature)
    const own = catalog.check(creatureCheck) ?? check
    return template && own ? { name: template.name, entity: spawn(template, catalog), check: own } : null
  }, [catalog, versus, creature, creatureCheck, check])
}

function tally(check: CheckDef, bonus: number | null, roll: CheckRoll | null): { lines: TallyLine[]; total: string } {
  return {
    lines: [
      { label: `Roll ${check.dice}`, value: roll ? String(roll.roll) : '?' },
      { label: check.label, value: roll ? signed(roll.bonus) : bonus === null ? '—' : signed(bonus) }
    ],
    total: roll ? String(roll.total) : '?'
  }
}

function CheckPanel({ trigger, ctx }: TriggerPanelProps) {
  const v = trigger.values
  const { catalog, party } = ctx
  const check = catalog?.check(String(v.check)) ?? null
  const versus = v.against === 'creature'
  const opponent = useOpponent(catalog, versus, String(v.creature), String(v.creatureCheck), check)
  const question = String(v.question ?? '').trim() || trigger.name
  const [who, setWho] = useState<string | null>(party.some((p) => p.sheet === ctx.sheet) ? ctx.sheet : (party[0]?.sheet ?? null))
  const [done, setDone] = useState<{ result: CheckResult; by: PlaceVisitor } | null>(null)
  const [rolling, setRolling] = useState(false)
  const entities = useMemo(() => new Map(catalog ? party.flatMap((p) => (p.game ? [[p.sheet, GameEntity.fromRecord(p.game, catalog)] as const] : [])) : []), [party, catalog])

  const missing = !catalog ? 'Loading the rules…' : !check ? 'This check has no roll picked, or its check was deleted. Edit the trigger to pick one.' : versus && !opponent ? 'Its creature, or the creature’s check, is missing. Edit the trigger to pick them.' : !party.length ? 'Only characters in the game can roll. Join from the character’s Game tab.' : null
  if (missing || !check) return <span className="text-[13px] text-faint">{missing}</span>

  const roll = () => {
    const by = party.find((p) => p.sheet === who)
    const entity = who ? entities.get(who) : undefined
    if (!by || !entity) return
    let result: CheckResult
    try {
      result = contest(rollCheck(entity, check, rollDie), opponent ? { roll: rollCheck(opponent.entity, opponent.check, rollDie) } : { dc: Number(v.dc) })
    } catch (err) {
      return toast.error('Could not roll', err instanceof Error ? err.message : String(err))
    }
    setDone({ result, by })
    setRolling(true)
    window.setTimeout(() => setRolling(false), ROLL_MS)
    const flag = String((result.passed ? v.passFlag : v.failFlag) ?? '')
    if (flag && ctx.save) void engine('saves.setFlag', { id: ctx.save.id, flag }).catch(failed('Could not set the flag'))
    void engine('worlds.addJourney', { id: ctx.world, sheet: by.sheet, kind: 'action', text: `${question}: ${result.passed ? 'passed' : 'failed'} (${rollLine(showName(by.name), result.roll)})` }).catch(failed('Could not note it in the journey'))
  }

  const people: Roller[] = party.map((p) => ({ sheet: p.sheet, name: p.name, image: p.image, bonus: bonusOf(entities.get(p.sheet), check) }))
  const settled = done && !rolling ? done : null
  const mine = tally(check, bonusOf(who ? entities.get(who) : undefined, check), settled?.result.roll ?? null)
  const against = settled?.result.against
  const theirs = opponent ? tally(opponent.check, bonusOf(opponent.entity, opponent.check), against && 'roll' in against ? against.roll : null) : null
  const dc = Number(v.dc)
  const needs = opponent ? `More than ${opponent.name}` : v.hideDc && !settled ? 'Hidden' : `${dc}`
  const outcome = settled ? String((settled.result.passed ? v.pass : v.fail) ?? '') : ''
  const item = String(v.passItem ?? '')
  const gold = Number(v.passGold) || 0
  const where = worldWhere(trigger.name, [], ctx.world, done?.by.sheet ?? ctx.sheet)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-dim">
          {check.label} check{opponent ? ` · against ${opponent.name}` : ''}
        </span>
        <span className="text-[17px] font-semibold text-white">{question}</span>
      </div>
      <WhoRolls label="Who rolls?" people={people} value={who} onPick={setWho} locked={done !== null} />
      <RollTally faces={settled?.result.roll.faces ?? null} rolling={rolling} lines={mine.lines} total={mine.total} needs={needs} verdict={settled ? settled.result.passed : null} />
      {opponent && theirs && <RollTally title={`${opponent.name} · ${opponent.check.label}`} faces={against && 'roll' in against ? against.roll.faces : null} rolling={rolling} lines={theirs.lines} total={theirs.total} verdict={settled ? !settled.result.passed : null} />}
      {!done && (
        <Button variant="primary" icon={<Dices />} disabled={!who} onClick={roll} className="h-11 justify-center text-[15px]">
          Roll
        </Button>
      )}
      {settled && (
        <>
          <RollVerdict passed={settled.result.passed} />
          {outcome && <Markdown text={outcome} className="text-[13.5px] leading-relaxed text-white/90" />}
          {settled.result.passed && (item || gold > 0) && <ItemReward sheet={settled.by.sheet} item={item} count={Number(v.passCount) || 1} gold={gold} />}
          <ActionBar items={[playOutItem(checkText(question, showName(settled.by.name), settled.result, opponent?.name ?? '', outcome), where), { label: 'Close', icon: <X />, onSelect: closePlay }]} />
        </>
      )}
    </div>
  )
}

function CheckEditor({ trigger, world, onValues }: TriggerEditorProps) {
  const v = trigger.values
  const set = (patch: Record<string, unknown>) => onValues({ ...v, ...patch })
  const checks = useGameDefs('check').list ?? []
  const creatures = useGameDefs(CREATURE_TEMPLATES).list ?? []

  const against = String(v.against || 'dc')
  const passFlag = String(v.passFlag || '')
  const failFlag = String(v.failFlag || '')
  const passItem = String(v.passItem || '')

  return (
    <div className="flex flex-col gap-3 font-mono text-[12px]">
      <FieldGrid dense>
        <Field label="What is tried" tip="Shown at the top, such as 'Search the well'. Empty uses trigger name.">
          <Input
            value={String(v.question ?? '')}
            onChange={(e) => set({ question: e.target.value })}
            placeholder={trigger.name}
          />
        </Field>
        <Field label="Check" tip="What the character rolls.">
          <Select
            value={String(v.check ?? '')}
            options={[{ value: '', label: 'Select a check...' }, ...checks.map((c) => ({ value: c.id, label: c.name }))]}
            onChange={(check) => set({ check })}
          />
        </Field>
        <Field label="Against" tip="Fixed DC or opposed contest against a creature.">
          <Select
            value={against}
            options={[
              { value: 'dc', label: 'Fixed DC' },
              { value: 'creature', label: 'Opposed by Creature' }
            ]}
            onChange={(against) => set({ against })}
          />
        </Field>
        {against === 'dc' ? (
          <Field label="Difficulty (DC)" tip="The total needed to pass.">
            <Input
              type="number"
              value={Number(v.dc) || 12}
              onChange={(e) => set({ dc: Number(e.target.value) })}
            />
          </Field>
        ) : (
          <>
            <Field label="Creature" tip="Who rolls against the player.">
              <Select
                value={String(v.creature ?? '')}
                options={[{ value: '', label: 'Select creature...' }, ...creatures.map((c) => ({ value: c.id, label: c.name }))]}
                onChange={(creature) => set({ creature })}
              />
            </Field>
            <Field label="Creature's check" tip="Empty uses the same check.">
              <Select
                value={String(v.creatureCheck ?? '')}
                options={[{ value: '', label: 'Same as character' }, ...checks.map((c) => ({ value: c.id, label: c.name }))]}
                onChange={(creatureCheck) => set({ creatureCheck })}
              />
            </Field>
          </>
        )}
      </FieldGrid>

      <div className="grid grid-cols-2 gap-3">
        <Field label="On a pass (text)" tip="Markdown shown on pass.">
          <Input
            value={String(v.pass ?? '')}
            onChange={(e) => set({ pass: e.target.value })}
            placeholder="You succeed..."
          />
        </Field>
        <Field label="On a fail (text)" tip="Markdown shown on fail.">
          <Input
            value={String(v.fail ?? '')}
            onChange={(e) => set({ fail: e.target.value })}
            placeholder="You fail..."
          />
        </Field>
      </div>

      <FieldGrid dense>
        <Field label="A pass sets flag" tip="Sets this world flag on pass.">
          <FlagSelect
            world={world}
            value={passFlag}
            onChange={(f) => set({ passFlag: f ?? '' })}
            placeholder="None"
          />
        </Field>
        <Field label="A fail sets flag" tip="Sets this world flag on fail.">
          <FlagSelect
            world={world}
            value={failFlag}
            onChange={(f) => set({ failFlag: f ?? '' })}
            placeholder="None"
          />
        </Field>
        <Field label="A pass finds (item)" tip="Reward item given on pass.">
          <ItemSelect
            value={passItem}
            onChange={(item) => set({ passItem: item ?? '' })}
            placeholder="None (no item reward)"
          />
        </Field>
        <Field label="Item count">
          <Input
            type="number"
            value={Number(v.passCount) || 1}
            min={1}
            onChange={(e) => set({ passCount: Number(e.target.value) })}
          />
        </Field>
        <Field label="Gold found">
          <Input
            type="number"
            value={Number(v.passGold) || 0}
            min={0}
            onChange={(e) => set({ passGold: Number(e.target.value) })}
          />
        </Field>
      </FieldGrid>
    </div>
  )
}

registerTriggerUi('check', { Panel: CheckPanel, Editor: CheckEditor })
