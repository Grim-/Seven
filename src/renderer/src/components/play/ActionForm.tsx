import { useState } from 'react'
import { Dices, Plus, Save, X } from 'lucide-react'
import { hasSwap, NO_SWAP } from '@shared/cardDecks'
import { BASE, CHANCE, MIDDLE, NEEDS_LABEL, actionText, chanceOf, findTarget, targetOf, type Action, type ActionCheck } from '@shared/actions'
import { Button, Eyebrow, Input, NumberField, Segmented } from '../ui'
import { SheetSelect } from '../data/sheet/SheetSelect'
import { SkillSelect } from '../decisions/SkillSelect'
import { RollerField } from './roll/RollerField'
import { rollAction } from './play'
import { useCheckTargets } from './useCheckTargets'
import type { PlayWhere } from './playStore'
import { CardSwapField } from './CardSwapField'
import { TriggerActionSelect } from '../game/TriggerActionSelect'

const BLANK_CHECK: ActionCheck = { against: CHANCE, difficulty: MIDDLE, base: BASE - 1, pass: null, fail: null, passCards: NO_SWAP, failCards: NO_SWAP, passAction: null, failAction: null }
export const BLANK_ACTION: Action = { attempt: '', needs: 'any', by: null, roller: 'player', checks: [BLANK_CHECK], pass: '', fail: '', passCards: NO_SWAP, failCards: NO_SWAP, passAction: null, failAction: null }
const NEEDS = (['any', 'all'] as const).map((value) => ({ value, label: NEEDS_LABEL[value] }))

interface Props {
  initial: Action
  character: string | null
  where: PlayWhere
  onKeep?: (text: string, action?: Action) => void
  onChange?: (action: Action) => void
  keepLabel: string
}

export function ActionForm({ initial, character, where, onKeep, onChange, keepLabel }: Props) {
  const [a, setA] = useState<Action>(initial)
  const set = (next: Action) => {
    setA(next)
    onChange?.(next)
  }
  const [mine, setMine] = useState<string | null>(character)
  const [openDetails, setOpenDetails] = useState<Record<number, boolean>>({})
  const targets = useCheckTargets(mine)
  const setCheck = (i: number, patch: Partial<ActionCheck>) => set({ ...a, checks: a.checks.map((c, j) => (j === i ? { ...c, ...patch } : c)) })
  const toggleDetails = (i: number) => setOpenDetails((prev) => ({ ...prev, [i]: !prev[i] }))

  const getReadyAction = (): Action => {
    const fallbackName =
      a.checks[0]?.against && a.checks[0].against !== CHANCE
        ? `${a.checks[0].against} check`
        : 'Interact'
    return {
      ...a,
      attempt: a.attempt.trim() || fallbackName
    }
  }

  const handleRoll = () => {
    const readyAction = getReadyAction()
    if (!a.attempt.trim()) set(readyAction)
    rollAction(readyAction, mine, where)
  }

  const handleKeep = () => {
    const readyAction = getReadyAction()
    if (!a.attempt.trim()) set(readyAction)
    onKeep?.(actionText(readyAction), readyAction)
  }

  const bestChance = a.checks.length
    ? Math.max(...a.checks.map((c) => chanceOf(c.against && c.against !== CHANCE ? (findTarget(targets, c.against)?.bonus ?? 0) : 0, targetOf(c))))
    : 0

  return (
    <div className="flex flex-col gap-3.5">
      {/* Attempt & Rules Header */}
      <div className="flex flex-col gap-2.5">
        <Input
          value={a.attempt}
          placeholder="What is attempted?"
          onChange={(e) => set({ ...a, attempt: e.target.value })}
          className="h-10 text-[15px] font-semibold text-white"
        />
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/40 pt-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-faint">Ways</span>
            <Segmented value={a.needs} options={NEEDS} onChange={(needs) => set({ ...a, needs })} />
          </div>
          <div className="flex items-center gap-4">
            <RollerField value={a.roller ?? 'player'} onChange={(roller) => set({ ...a, roller })} />
            <label className="flex items-center gap-2 text-[11px] text-dim">
              <span className="font-mono uppercase tracking-[0.1em] text-faint">Preview with</span>
              <SheetSelect value={mine} onChange={setMine} className="h-7 w-36 text-[11.5px]" noneLabel="None (+0)" />
            </label>
          </div>
        </div>
      </div>

      {/* Checks List */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Eyebrow>Ways to try it (Checks)</Eyebrow>
          <span className="font-mono text-[11px] text-faint">DC changes update chance in real-time</span>
        </div>

        {a.checks.map((c, i) => {
          const isChance = !c.against || c.against === CHANCE
          const bonus = isChance ? 0 : (findTarget(targets, c.against)?.bonus ?? 0)
          const currentTarget = targetOf(c)
          const chance = isChance ? chanceOf(0, currentTarget) : chanceOf(bonus, currentTarget)
          const hasCustom = Boolean(c.pass || c.fail || hasSwap(c.passCards) || hasSwap(c.failCards))
          const showDetails = openDetails[i] || hasCustom

          return (
            <div key={i} className="flex flex-col gap-1.5 border border-line/50 bg-white/[0.02] p-2.5 transition hover:border-line-strong">
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-5 text-center font-mono text-xs font-bold text-accent">{i + 1}</span>
                <SkillSelect
                  chance
                  targets={targets}
                  value={c.against ?? CHANCE}
                  onChange={(against) => setCheck(i, { against })}
                  className="h-7 min-w-[13rem] flex-1 text-[12px]"
                />

                {isChance ? (
                  <div className="flex items-center gap-1">
                    <NumberField
                      value={Math.round(chance * 100)}
                      min={0}
                      max={100}
                      step={5}
                      onChange={(pct) => {
                        const val = Math.min(100, Math.max(0, pct ?? 50))
                        const target = Math.max(1, Math.min(21, 21 - Math.round(20 * (val / 100))))
                        setCheck(i, { base: target - 1, difficulty: MIDDLE })
                      }}
                      className="h-7 w-16 text-center text-[12px]"
                    />
                    <span className="font-mono text-[11px] text-dim">%</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[11px] text-dim">DC</span>
                    <NumberField
                      value={currentTarget}
                      min={1}
                      max={30}
                      step={1}
                      onChange={(dc) => setCheck(i, { base: (dc ?? BASE) - 1, difficulty: MIDDLE })}
                      className="h-7 w-14 text-center text-[12px]"
                    />
                    <span className="w-12 text-center font-mono text-[13px] font-bold text-cyan" title="Chance to pass">
                      {Math.round(chance * 100)}%
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => toggleDetails(i)}
                  className="border border-line/50 px-2 py-0.5 font-mono text-[11px] text-dim transition hover:border-accent hover:text-white"
                >
                  {showDetails ? 'Hide' : 'Custom outcome'}
                </button>

                <button
                  type="button"
                  title="Remove this check"
                  disabled={a.checks.length < 2}
                  onClick={() => set({ ...a, checks: a.checks.filter((_, j) => j !== i) })}
                  className="px-1 text-faint transition hover:text-alert disabled:opacity-20"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {showDetails && (
                <div className="flex flex-col gap-1.5 border-t border-line/30 pt-2">
                  <div className="grid grid-cols-2 gap-1.5">
                    <Input
                      value={c.pass ?? ''}
                      placeholder="If this decides it and passes…"
                      onChange={(e) => setCheck(i, { pass: e.target.value || null })}
                      className="h-7 text-[12px]"
                    />
                    <Input
                      value={c.fail ?? ''}
                      placeholder="If this decides it and fails…"
                      onChange={(e) => setCheck(i, { fail: e.target.value || null })}
                      className="h-7 text-[12px]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <CardSwapField value={c.passCards} onChange={(passCards) => setCheck(i, { passCards })} />
                    <CardSwapField value={c.failCards} onChange={(failCards) => setCheck(i, { failCards })} />
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <TriggerActionSelect
                      value={c.passAction}
                      onChange={(passAction) => setCheck(i, { passAction })}
                      placeholder="No in-game trigger on pass"
                      className="h-7 text-[11px]"
                    />
                    <TriggerActionSelect
                      value={c.failAction}
                      onChange={(failAction) => setCheck(i, { failAction })}
                      placeholder="No in-game trigger on fail"
                      className="h-7 text-[11px]"
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}

        <div>
          <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => set({ ...a, checks: [...a.checks, BLANK_CHECK] })} className="self-start">
            Another way
          </Button>
        </div>
      </div>

      {/* Outcomes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <div className="flex flex-col gap-2 border border-ok/40 bg-ok/[0.05] p-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ok">On a pass</span>
            <span className="font-mono text-[10px] uppercase text-ok/70">Success</span>
          </div>
          <Input
            value={a.pass}
            placeholder="Pass: what happens on success"
            onChange={(e) => set({ ...a, pass: e.target.value })}
            className="h-8 text-[12.5px]"
          />
          <CardSwapField value={a.passCards} onChange={(passCards) => set({ ...a, passCards })} />
          <TriggerActionSelect
            value={a.passAction}
            onChange={(passAction) => set({ ...a, passAction })}
            placeholder="No in-game action on pass"
            className="h-8 text-[11.5px]"
          />
        </div>

        <div className="flex flex-col gap-2 border border-alert/40 bg-alert/[0.05] p-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-alert">On a fail</span>
            <span className="font-mono text-[10px] uppercase text-alert/70">Failure</span>
          </div>
          <Input
            value={a.fail}
            placeholder="Fail: what happens on failure"
            onChange={(e) => set({ ...a, fail: e.target.value })}
            className="h-8 text-[12.5px]"
          />
          <CardSwapField value={a.failCards} onChange={(failCards) => set({ ...a, failCards })} />
          <TriggerActionSelect
            value={a.failAction}
            onChange={(failAction) => set({ ...a, failAction })}
            placeholder="No in-game action on fail"
            className="h-8 text-[11.5px]"
          />
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/40 pt-2">
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="secondary"
            icon={<Dices className="h-3.5 w-3.5 text-accent" />}
            onClick={handleRoll}
            title="Roll this action right now"
          >
            Roll it
          </Button>
          <span className="font-mono text-xs text-dim">
            Best chance: <b className="text-cyan">{Math.round(bestChance * 100)}%</b>
          </span>
        </div>
        {onKeep && (
          <Button
            size="sm"
            variant="primary"
            icon={<Save className="h-3.5 w-3.5" />}
            onClick={handleKeep}
            title={keepLabel}
          >
            {keepLabel}
          </Button>
        )}
      </div>
    </div>
  )
}
