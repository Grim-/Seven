import { useState, useMemo, useEffect } from 'react'
import { checkFormula } from '@shared/game/core/formula'
import { Button, Input, NumberField, Select } from '../../ui'
import { useGameCatalog } from '../useGameCatalog'
import { registerParamEditor, type ParamEditorProps } from './registry'
import { Dices, Code, Sparkles, User, Crosshair } from 'lucide-react'

const DEFAULT_STATS = [
  { id: 'wis', label: 'Wisdom (wis)' },
  { id: 'str', label: 'Strength (str)' },
  { id: 'dex', label: 'Dexterity (dex)' },
  { id: 'con', label: 'Constitution (con)' },
  { id: 'int', label: 'Intelligence (int)' },
  { id: 'cha', label: 'Charisma (cha)' },
  { id: 'level', label: 'Level (level)' },
  { id: 'armour', label: 'Armour (armour)' }
]

const DIE_OPTIONS = [
  { value: '0', label: 'No dice (flat or stat only)' },
  { value: '4', label: 'd4' },
  { value: '6', label: 'd6' },
  { value: '8', label: 'd8' },
  { value: '10', label: 'd10' },
  { value: '12', label: 'd12' },
  { value: '20', label: 'd20' },
  { value: '100', label: 'd100' }
]

const TARGET_OPTIONS = [
  { value: 'none', label: 'No stat bonus' },
  { value: 'user', label: 'User / Caster' },
  { value: 'target', label: 'Target creature' }
]

interface ParsedFormula {
  count: number
  sides: number
  target: 'none' | 'user' | 'target'
  stat: string
  flat: number
  isComplex: boolean
}

function parseFormulaString(source: string): ParsedFormula {
  const text = String(source || '').trim()
  if (!text) {
    return { count: 0, sides: 0, target: 'none', stat: '', flat: 0, isComplex: false }
  }

  // Check for complex constructs (parentheses, functions like min/max, division, multiplication)
  if (/[()*/]/.test(text) || /\b(min|max|floor|ceil|round|clamp)\b/i.test(text)) {
    return { count: 0, sides: 0, target: 'none', stat: '', flat: 0, isComplex: true }
  }

  const diceMatch = text.match(/(\d+)d(\d+)/i)
  const userStatMatch = text.match(/user\.([a-zA-Z0-9_]+)/i)
  const targetStatMatch = text.match(/target\.([a-zA-Z0-9_]+)/i)

  let cleanText = text
  let count = 0
  let sides = 0
  if (diceMatch) {
    count = parseInt(diceMatch[1], 10)
    sides = parseInt(diceMatch[2], 10)
    cleanText = cleanText.replace(diceMatch[0], '')
  }

  let target: 'none' | 'user' | 'target' = 'none'
  let stat = ''
  if (userStatMatch) {
    target = 'user'
    stat = userStatMatch[1]
    cleanText = cleanText.replace(userStatMatch[0], '')
  } else if (targetStatMatch) {
    target = 'target'
    stat = targetStatMatch[1]
    cleanText = cleanText.replace(targetStatMatch[0], '')
  }

  // Find remaining flat numbers
  const numMatches = cleanText.match(/[+-]?\s*\d+/g)
  let flat = 0
  if (numMatches) {
    for (const m of numMatches) {
      flat += parseInt(m.replace(/\s+/g, ''), 10)
    }
  }

  return { count, sides, target, stat, flat, isComplex: false }
}

function buildFormulaString(p: { count: number; sides: number; target: string; stat: string; flat: number }): string {
  const chunks: string[] = []
  if (p.sides > 0 && p.count > 0) {
    chunks.push(`${p.count}d${p.sides}`)
  }
  if (p.target !== 'none' && p.stat) {
    chunks.push(`${p.target}.${p.stat}`)
  }
  if (p.flat !== 0) {
    chunks.push(String(p.flat))
  }
  if (chunks.length === 0) return '0'

  let result = chunks[0]
  for (let i = 1; i < chunks.length; i++) {
    const c = chunks[i]
    if (c.startsWith('-')) {
      result += ` - ${c.slice(1)}`
    } else {
      result += ` + ${c}`
    }
  }
  return result
}

function FormulaParam({ value, onChange }: ParamEditorProps) {
  const catalog = useGameCatalog()
  const rawText = typeof value === 'string' ? value : ''

  const initialParsed = useMemo(() => parseFormulaString(rawText), [rawText])
  const [isRawMode, setIsRawMode] = useState(initialParsed.isComplex)

  // Local structured state
  const [count, setCount] = useState(initialParsed.count || 1)
  const [sides, setSides] = useState(initialParsed.sides || 0)
  const [target, setTarget] = useState<'none' | 'user' | 'target'>(initialParsed.target)
  const [stat, setStat] = useState(initialParsed.stat || 'wis')
  const [flat, setFlat] = useState(initialParsed.flat || 0)

  // Sync from outside value when rawText changes
  useEffect(() => {
    const parsed = parseFormulaString(rawText)
    if (parsed.isComplex) {
      setIsRawMode(true)
    } else {
      setCount(parsed.count || (parsed.sides ? 1 : 0))
      setSides(parsed.sides)
      setTarget(parsed.target)
      if (parsed.stat) setStat(parsed.stat)
      setFlat(parsed.flat)
    }
  }, [rawText])

  // Available stats from catalog
  const statOptions = useMemo(() => {
    const catalogStats = catalog?.stats() ?? []
    const list = catalogStats.length > 0
      ? catalogStats.map((s) => ({ value: s.id, label: `${s.label} (${s.id})` }))
      : DEFAULT_STATS.map((s) => ({ value: s.id, label: s.label }))

    // If current stat is not in options, append it so it's not lost
    if (stat && !list.some((o) => o.value === stat)) {
      list.push({ value: stat, label: `${stat} (${stat})` })
    }
    return list
  }, [catalog, stat])

  const updateStructured = (next: { count: number; sides: number; target: 'none' | 'user' | 'target'; stat: string; flat: number }) => {
    setCount(next.count)
    setSides(next.sides)
    setTarget(next.target)
    setStat(next.stat)
    setFlat(next.flat)
    const built = buildFormulaString(next)
    onChange(built)
  }

  const problem = rawText.trim() ? checkFormula(rawText) : null

  return (
    <div className="flex flex-col gap-2 border border-line bg-black/60 p-3">
      {/* Visual / Raw Mode Switcher Header */}
      <div className="flex items-center justify-between text-[11px] font-mono border-b border-line/40 pb-2">
        <div className="flex items-center gap-1.5 text-dim">
          <Dices className="h-3.5 w-3.5 text-accent" />
          <span className="text-white font-semibold uppercase tracking-wider">Formula Builder</span>
        </div>
        <div className="flex items-center gap-2">
          {rawText && (
            <span className="text-[11.5px] px-2 py-0.5 border border-accent/40 bg-accent/10 text-accent font-semibold">
              = {rawText}
            </span>
          )}
          <button
            type="button"
            onClick={() => setIsRawMode(!isRawMode)}
            className="flex items-center gap-1 px-2 py-0.5 border border-line bg-black text-dim hover:text-white hover:border-accent transition-colors"
            title={isRawMode ? 'Switch to structured dice & stat pickers' : 'Switch to raw text formula'}
          >
            {isRawMode ? <Sparkles className="h-3 w-3 text-accent" /> : <Code className="h-3 w-3" />}
            <span>{isRawMode ? 'Visual Builder' : 'Raw Text'}</span>
          </button>
        </div>
      </div>

      {/* Structured Formula Controls */}
      {!isRawMode ? (
        <div className="flex flex-col gap-2.5 pt-1">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 1. Dice Component */}
            <div className="flex flex-col gap-1 border border-line/40 bg-black/40 p-2">
              <label className="text-[10.5px] font-mono uppercase text-dim flex items-center gap-1">
                <Dices className="h-3 w-3 text-accent" />
                <span>Dice Roll</span>
              </label>
              <div className="flex items-center gap-1.5">
                {sides > 0 && (
                  <div className="w-16">
                    <NumberField
                      value={count}
                      min={1}
                      max={100}
                      onChange={(v) => updateStructured({ count: v ?? 1, sides, target, stat, flat })}
                      className="h-8 text-[12px] font-mono"
                    />
                  </div>
                )}
                <div className="flex-1">
                  <Select
                    value={String(sides)}
                    options={DIE_OPTIONS}
                    onChange={(v) => {
                      const nextSides = parseInt(v, 10)
                      updateStructured({
                        count: nextSides > 0 && count === 0 ? 1 : count,
                        sides: nextSides,
                        target,
                        stat,
                        flat
                      })
                    }}
                    className="h-8 text-[12px] font-mono bg-black"
                  />
                </div>
              </div>
            </div>

            {/* 2. Stat Bonus Component */}
            <div className="flex flex-col gap-1 border border-line/40 bg-black/40 p-2">
              <label className="text-[10.5px] font-mono uppercase text-dim flex items-center gap-1">
                {target === 'target' ? <Crosshair className="h-3 w-3 text-rose-400" /> : <User className="h-3 w-3 text-cyan-400" />}
                <span>Stat Bonus</span>
              </label>
              <div className="flex items-center gap-1.5">
                <div className="w-[110px] shrink-0">
                  <Select
                    value={target}
                    options={TARGET_OPTIONS}
                    onChange={(v) => updateStructured({ count, sides, target: v as 'none' | 'user' | 'target', stat, flat })}
                    className="h-8 text-[12px] font-mono bg-black"
                  />
                </div>
                {target !== 'none' && (
                  <div className="flex-1 min-w-0">
                    <Select
                      value={stat}
                      options={statOptions}
                      onChange={(s) => updateStructured({ count, sides, target, stat: s, flat })}
                      className="h-8 text-[12px] font-mono bg-black"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* 3. Flat Modifier Component */}
            <div className="flex flex-col gap-1 border border-line/40 bg-black/40 p-2">
              <label className="text-[10.5px] font-mono uppercase text-dim">Flat Bonus / Penalty</label>
              <div className="flex items-center gap-1.5">
                <NumberField
                  value={flat}
                  onChange={(v) => updateStructured({ count, sides, target, stat, flat: v ?? 0 })}
                  className="h-8 text-[12px] font-mono flex-1"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => updateStructured({ count, sides, target, stat, flat: 0 })}
                  title="Reset flat bonus to 0"
                  className="h-8 px-2 text-[10.5px] font-mono border border-line/40"
                  disabled={flat === 0}
                >
                  Clear
                </Button>
              </div>
            </div>
          </div>

          <span className="text-[11px] text-dim font-mono">
            Combines dice ({sides > 0 ? `${count}d${sides}` : 'none'}), stat modifier ({target !== 'none' ? `${target}.${stat}` : 'none'}), and flat value ({flat >= 0 ? `+${flat}` : flat}).
          </span>
        </div>
      ) : (
        /* Raw Text Editor Mode */
        <div className="flex flex-col gap-1.5 pt-1">
          <Input
            value={rawText}
            spellCheck={false}
            onChange={(e) => onChange(e.target.value)}
            className="font-mono text-[12.5px] h-9"
            placeholder="e.g. 1d8 + user.wis + 3"
          />
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-dim">Supports dice notation, user.&lt;stat&gt;, target.&lt;stat&gt;, and math expressions.</span>
            {problem && <span className="font-mono text-alert">{problem}</span>}
          </div>
        </div>
      )}
    </div>
  )
}

registerParamEditor('formula', { Editor: FormulaParam, wide: true })
