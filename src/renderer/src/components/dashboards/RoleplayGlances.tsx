import { useState } from 'react'
import { Copy, Dices, Play, RotateCcw, Sparkles } from 'lucide-react'
import { backgroundInfo, effectSettingsFor } from '@shared/backgrounds'
import { Button, Input } from '../ui'
import { SettingControls } from '../settingSpec/SettingControls'
import { runCue } from '../shell/ThemeStage'
import { useActiveTheme, useThemes } from '../../store/themes'
import { engine } from '../../lib/ipc'
import { copyText, failed } from '../../lib/notify'
import { cn } from '../../lib/cn'

interface DiceRollResult {
  id: number
  formula: string
  dice: number[]
  modifier: number
  total: number
  sides: number
}

const DIE_PRESETS = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'] as const

function rollFormula(raw: string): DiceRollResult | null {
  const clean = raw.trim().toLowerCase().replace(/\s+/g, '')
  const m = /^(\d*)d(\d+)(?:([+-])(\d+))?$/.exec(clean)
  if (!m) return null
  const count = Math.min(50, Math.max(1, m[1] ? parseInt(m[1], 10) : 1))
  const sides = Math.min(1000, Math.max(2, parseInt(m[2], 10)))
  const mod = m[4] ? parseInt(m[4], 10) * (m[3] === '-' ? -1 : 1) : 0
  const dice = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1)
  const total = dice.reduce((sum, n) => sum + n, 0) + mod
  return { id: Date.now() + Math.random(), formula: `${count}d${sides}${mod ? (mod > 0 ? `+${mod}` : String(mod)) : ''}`, dice, modifier: mod, total, sides }
}

/** Interactive dice roller widget for quick tabletop and roleplay checks. */
export function DiceGlance() {
  const [formula, setFormula] = useState('1d20')
  const [history, setHistory] = useState<DiceRollResult[]>([])
  const latest = history[0] ?? null

  const roll = (expr: string) => {
    const res = rollFormula(expr)
    if (!res) return
    setFormula(expr)
    setHistory((prev) => [res, ...prev].slice(0, 12))
  }

  const parsed = rollFormula(formula)
  const modText = latest && latest.modifier !== 0 ? ` ${latest.modifier > 0 ? '+' : '-'} ${Math.abs(latest.modifier)}` : ''
  const isNatCrit = latest?.sides === 20 && latest.dice.length === 1 && latest.dice[0] === 20
  const isNatFumble = latest?.sides === 20 && latest.dice.length === 1 && latest.dice[0] === 1

  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden">
      <div className="flex flex-wrap gap-1">
        {DIE_PRESETS.map((die) => (
          <button
            key={die}
            type="button"
            onClick={() => roll(die)}
            className="border border-line/60 bg-black/40 px-2 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-white/85 hover:border-accent hover:text-accent"
          >
            {die}
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          roll(formula)
        }}
        className="flex items-center gap-1.5"
      >
        <Input
          value={formula}
          onChange={(e) => setFormula(e.target.value)}
          placeholder="2d6+3"
          className="h-8 min-w-0 flex-1 font-mono text-[12px]"
        />
        <Button type="submit" size="sm" variant="primary" icon={<Dices />} disabled={!parsed}>
          Roll
        </Button>
      </form>
      <div className="flex flex-col items-center justify-center border border-line/40 bg-black/45 px-2.5 py-2 text-center">
        {latest ? (
          <>
            <div className="flex items-center gap-2">
              <span className={cn('font-mono text-[28px] font-bold leading-none tabular-nums', isNatCrit ? 'text-teal' : isNatFumble ? 'text-alert' : 'text-accent')}>
                {latest.total}
              </span>
              <button
                type="button"
                title="Copy roll result"
                onClick={() => void copyText(`${latest.formula}: ${latest.total} [${latest.dice.join(', ')}]${modText}`, 'Copied roll', `${latest.formula} → ${latest.total}`)}
                className="text-dim hover:text-accent"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-1 font-mono text-[10.5px] text-dim">
              {latest.formula} · [{latest.dice.join(', ')}]{modText}
            </div>
          </>
        ) : (
          <div className="font-mono text-[11px] text-faint">Pick a die or type a formula</div>
        )}
      </div>
      {history.length > 1 && (
        <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto border-t border-line/30 pt-1">
          {history.slice(1).map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => roll(r.formula)}
              className="flex items-center justify-between px-1.5 py-0.5 font-mono text-[10.5px] text-dim hover:bg-white/[0.04] hover:text-white"
            >
              <span>{r.formula}</span>
              <span className="text-white/85">{r.total}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Live control panel for the active animated background's fields and reaction triggers. */
export function BackgroundControlGlance() {
  const { theme } = useActiveTheme()
  const preview = useThemes((s) => s.preview)
  const info = backgroundInfo(theme.effect)
  const values = info ? effectSettingsFor(info, theme.effectSettings) : {}

  const updateSetting = (name: string, value: number | string) => {
    const nextSettings = { ...theme.effectSettings, [name]: value }
    if (theme.builtin) {
      useThemes.setState({ preview: { ...theme, effectSettings: nextSettings } })
      return
    }
    void engine('themes.save', { id: theme.id, effectSettings: nextSettings })
      .then(() => useThemes.getState().refresh())
      .catch(failed('Could not update background'))
  }

  return (
    <div className="flex h-full flex-col gap-2.5 overflow-y-auto pr-0.5">
      <div className="flex items-center justify-between gap-2 border-b border-line/35 pb-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-accent-soft" />
          <span className="truncate font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-white/90">
            {info?.name ?? theme.effect}
          </span>
        </div>
        {preview && (
          <button
            type="button"
            title="Reset live preview"
            onClick={() => useThemes.setState({ preview: null })}
            className="flex items-center gap-1 font-mono text-[10px] text-dim hover:text-accent"
          >
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
        )}
      </div>

      {!info && (
        <div className="font-mono text-[11px] text-faint">
          No animated background effect active on {theme.name}.
        </div>
      )}

      {info && info.reactions.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-accent-soft">Triggers</div>
          <div className="flex flex-wrap gap-1.5">
            {info.reactions.map((r) => (
              <Button
                key={r.name}
                size="sm"
                variant="secondary"
                icon={<Play />}
                title={r.description}
                onClick={() => runCue({ sound: null, flash: null, shake: false, reaction: r.name })}
              >
                {r.name.replace(/_/g, ' ')}
              </Button>
            ))}
          </div>
        </div>
      )}

      {info && info.settings.length > 0 && (
        <div className="grid grid-cols-1 gap-2.5">
          <SettingControls
            specs={info.settings}
            values={values}
            onChange={(name, value) => updateSetting(name, value as number | string)}
          />
        </div>
      )}
    </div>
  )
}
