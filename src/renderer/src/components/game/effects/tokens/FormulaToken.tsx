import { useState, type MouseEvent } from 'react'
import { Plus } from 'lucide-react'
import { checkFormula } from '@shared/game/core/formula'
import { defId } from '@shared/game/defs'
import type { Catalog } from '@shared/game/core'
import { cn } from '../../../../lib/cn'
import { engine } from '../../../../lib/ipc'
import { failed } from '../../../../lib/notify'
import { toast } from '../../../../store/toasts'
import { BrowsePick, Button, CountStepper, Eyebrow, Fold, Input, Segmented, Slider, askText } from '../../../ui'
import { useGameCatalog } from '../../useGameCatalog'
import { useGameDefs } from '../../useGameDefs'
import { diceRange, diceSpread, joinFormula, splitFormula, type FormulaParts, type StatTerm } from '../formula'
import { DieButton } from './DieButton'
import { registerEffectToken, type TokenEditProps, type TokenProps } from './registry'

const SIDES = [4, 6, 8, 10, 12, 20, 100]

const statLabel = (cat: Catalog | null, id: string): string => cat?.stat(id)?.label ?? id.toUpperCase()

export function prettyFormula(source: string, cat: Catalog | null): string {
  return source.replace(/\b(user|target)\.([A-Za-z_]\w*)/g, (_, who: string, stat: string) =>
    who === 'target' ? `target's ${statLabel(cat, stat)}` : statLabel(cat, stat)
  )
}

function Text({ value }: TokenProps) {
  const cat = useGameCatalog()
  const formulas = useGameDefs('formula').list ?? []
  const source = typeof value === 'string' ? value : ''
  const saved = formulas.find((f) => f.id === source.trim())
  if (saved) {
    return <span title={String(saved.values.formula ?? '')}>{saved.name}</span>
  }
  const parts = splitFormula(source)
  const r = parts && Object.keys(parts.dice).length ? diceRange(parts) : null
  return (
    <>
      {prettyFormula(source, cat)}
      {r && <span className="ml-[0.35em] font-normal text-[0.82em] text-dim">{`${r.lo}–${r.hi}`}</span>}
    </>
  )
}

function Builder({
  parts,
  ranged,
  set
}: {
  parts: FormulaParts
  ranged: { min: number; max: number } | null
  set: (next: FormulaParts) => void
}) {
  const cat = useGameCatalog()
  const [who, setWho] = useState<StatTerm['who']>('user')
  const r = diceRange(parts)
  const hasDice = Object.values(parts.dice).some((n) => n > 0)
  const changeDie = (sides: number, by: number) =>
    set({ ...parts, dice: { ...parts.dice, [sides]: Math.max(0, (parts.dice[sides] ?? 0) + by) } })
  const has = (stat: string) => parts.stats.some((s) => s.who === who && s.stat === stat)
  const toggle = (stat: string) =>
    set({
      ...parts,
      stats: has(stat) ? parts.stats.filter((s) => !(s.who === who && s.stat === stat)) : [...parts.stats, { who, stat }]
    })
  const statList = cat?.stats() ?? []
  return (
    <>
      <div className="flex items-baseline justify-between gap-3 border border-line/50 tone-panel-50 px-3 py-2">
        <span className="font-ui text-[15px] font-bold text-ink">{prettyFormula(joinFormula(parts), cat)}</span>
        {hasDice && (
          <span className="whitespace-nowrap font-ui text-[12px] text-tint-cyan">
            {`${r.lo}–${r.hi} · avg ${Math.round(r.avg * 10) / 10}${parts.stats.length ? ' + stats' : ''}`}
          </span>
        )}
      </div>
      {hasDice && (
        <div className="flex h-8 items-end gap-px">
          {diceSpread(parts).map((h, i) => (
            <i key={i} className="min-h-[2px] flex-1 bg-tint-cyan/55" style={{ height: `${h * 100}%` }} />
          ))}
        </div>
      )}
      <Eyebrow className="text-faint">Dice · click the count to take one away</Eyebrow>
      <div className="flex flex-wrap gap-1.5">
        {SIDES.map((s) => (
          <DieButton
            key={s}
            sides={s}
            count={parts.dice[s] ?? 0}
            onAdd={() => changeDie(s, 1)}
            onRemove={(e?: MouseEvent) => {
              e?.preventDefault()
              changeDie(s, -1)
            }}
          />
        ))}
      </div>
      {statList.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-2">
            <Eyebrow className="text-faint">Add a stat</Eyebrow>
            <Segmented
              value={who}
              onChange={setWho}
              options={[
                { value: 'user', label: 'Of the user' },
                { value: 'target', label: 'Of the target' }
              ]}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {statList.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => toggle(s.id)}
                className={cn(
                  'border px-2 py-1 font-ui text-[12px]',
                  has(s.id) ? 'border-accent bg-accent text-on-accent' : 'border-line/60 text-dim hover:border-dim hover:text-ink'
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </>
      )}
      <Eyebrow className="text-faint">Flat</Eyebrow>
      {ranged && !hasDice && !parts.stats.length ? (
        <div className="flex items-center gap-3">
          <span className="w-12 font-ui text-[22px] font-bold text-tint-cyan">{parts.flat}</span>
          <Slider value={parts.flat} min={ranged.min} max={ranged.max} onChange={(flat) => set({ ...parts, flat })} />
        </div>
      ) : (
        <CountStepper value={parts.flat} min={-999} onChange={(flat) => set({ ...parts, flat })} />
      )}
    </>
  )
}

export function FormulaEdit({ spec, value, onChange }: Pick<TokenEditProps, 'spec' | 'value' | 'onChange'>) {
  const cat = useGameCatalog()
  const formulas = useGameDefs('formula').list ?? []
  const source = typeof value === 'string' ? value : ''
  const selectedDef = formulas.find((f) => f.id === source.trim()) ?? null
  const parts = selectedDef ? null : splitFormula(source)
  const problem = !selectedDef && source.trim() ? checkFormula(source) : null
  const ranged = spec.min !== undefined && spec.max !== undefined ? { min: spec.min, max: spec.max } : null

  const createFormula = () => {
    const initialExpr = selectedDef ? String(selectedDef.values.formula ?? '0') : source || '10'
    askText('Save as Formula', 'Formula name (e.g. Spell Save DC)', '', async (name) => {
      const cleanName = name.trim()
      if (!cleanName) return
      const id = defId(cleanName)
      if (!id) return
      try {
        const saved = await engine('game.save', {
          type: 'formula',
          def: { id, name: cleanName, notes: '', values: { formula: initialExpr } },
          previousId: null
        })
        onChange(saved.id)
        toast.success('Formula saved', `${cleanName} (${initialExpr})`)
      } catch (err) {
        failed('Could not save formula')(err)
      }
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <Eyebrow className="text-faint">Saved Formula</Eyebrow>
          <Button size="sm" variant="ghost" icon={<Plus className="h-3 w-3" />} onClick={createFormula}>
            New formula…
          </Button>
        </div>
        <BrowsePick
          value={selectedDef ? selectedDef.id : null}
          options={formulas.map((f) => ({
            value: f.id,
            label: f.name,
            group: 'Formulas',
            note: prettyFormula(String(f.values.formula ?? ''), cat)
          }))}
          placeholder="Select a saved formula…"
          onChange={(id) => {
            if (id) onChange(id)
          }}
        />
      </div>

      {selectedDef ? (
        <div className="flex items-center justify-between gap-2 border border-line/50 tone-panel-50 px-3 py-2">
          <div className="min-w-0">
            <div className="text-[12.5px] font-semibold text-ink">{selectedDef.name}</div>
            <div className="truncate font-mono text-[11px] text-dim">{String(selectedDef.values.formula ?? '')}</div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onChange(String(selectedDef.values.formula ?? '0'))}
            title="Copy expression to edit inline"
          >
            Edit inline
          </Button>
        </div>
      ) : (
        <>
          {parts ? (
            <Builder parts={parts} ranged={ranged} set={(next) => onChange(joinFormula(next))} />
          ) : (
            <span className="text-[12px] text-dim">Custom expression.</span>
          )}
          <Fold label="Expression" defaultOpen={false}>
            <div className="flex flex-col gap-1 pt-1">
              <Input
                value={source}
                spellCheck={false}
                onChange={(e) => onChange(e.target.value)}
                className="h-8 font-mono text-[12.5px]"
                placeholder="1d8 + user.wis + 3"
              />
              {problem && <span className="font-ui text-[11px] text-alert">{problem}</span>}
            </div>
          </Fold>
        </>
      )}
    </div>
  )
}

registerEffectToken('formula', { Text, Edit: FormulaEdit, wide: true })
