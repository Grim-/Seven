import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { FACTION_STANCES, STANCE_BADGE, type FactionStance, type StoredFaction } from '@shared/game/factions'
import { cn } from '../../lib/cn'
import { Button, Eyebrow, Input, Popover } from '../ui'

const SHORT_STANCE: Record<FactionStance, string> = {
  allied: 'ALY',
  friendly: 'FRD',
  neutral: 'NEU',
  unfriendly: 'UNF',
  hostile: 'HOS'
}

export function factionMonogram(name: string): string {
  const words = name
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!words.length) return '??'
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase()
  return words
    .slice(0, 3)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

/**
 * Compact square-cell N×N world diplomacy matrix.
 * Cells stay fixed square boxes (w-9 h-9) rather than stretching across the viewport.
 */
export function WorldDiplomacyMatrix({
  factions,
  readOnly = false,
  selectedId = null,
  onSelectFaction,
  onChangeRelation
}: {
  factions: StoredFaction[]
  readOnly?: boolean
  selectedId?: string | null
  onSelectFaction?: (id: string) => void
  onChangeRelation?: (from: StoredFaction, targetId: string, stance: FactionStance | null, note: string) => void
}) {
  const [hoverCell, setHoverCell] = useState<{ row: string; col: string } | null>(null)

  if (factions.length < 2) return null

  return (
    <div className="flex flex-col gap-2.5 border border-line/50 tone-panel-40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Eyebrow className="text-secondary-ink">
          {readOnly ? 'Diplomacy Matrix' : 'Diplomacy Matrix · Click any box to set stance'}
        </Eyebrow>
        <div className="flex flex-wrap items-center gap-2 text-[10px] text-faint">
          {FACTION_STANCES.map((s) => (
            <span key={s} className="flex items-center gap-1">
              <span className={cn('border px-1 font-data text-[9px] font-bold', STANCE_BADGE[s].cls)}>
                {SHORT_STANCE[s]}
              </span>
              <span className="capitalize">{s}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto pb-1">
        <table className="w-max border-collapse text-[11px]">
          <thead>
            <tr>
              <th className="w-36 border border-line/40 tone-well-60 px-2 py-1 text-left font-label text-[9.5px] caps-8 text-dim">
                From \ To
              </th>
              {factions.map((col) => {
                const isColHot = hoverCell?.col === col.id || selectedId === col.id
                return (
                  <th
                    key={col.id}
                    title={col.name}
                    onClick={() => onSelectFaction?.(col.id)}
                    className={cn(
                      'h-9 w-9 cursor-pointer border border-line/40 p-0 text-center font-data text-[10px] font-bold transition-colors',
                      isColHot ? 'bg-accent/15 text-accent' : 'tone-well-60 text-ink hover:text-accent'
                    )}
                  >
                    {factionMonogram(col.name)}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {factions.map((row) => {
              const isRowHot = hoverCell?.row === row.id || selectedId === row.id
              return (
                <tr key={row.id}>
                  <td
                    title={row.name}
                    onClick={() => onSelectFaction?.(row.id)}
                    className={cn(
                      'max-w-36 cursor-pointer truncate border border-line/40 px-2 py-1 text-[11.5px] font-semibold transition-colors',
                      isRowHot ? 'bg-accent/12 text-accent' : 'tone-well-40 text-ink hover:text-accent'
                    )}
                  >
                    <span className="mr-1.5 font-data text-[9.5px] text-faint">{factionMonogram(row.name)}</span>
                    <span>{row.name}</span>
                  </td>
                  {factions.map((col) => {
                    if (row.id === col.id) {
                      return (
                        <td
                          key={col.id}
                          className="h-9 w-9 border border-line/30 tone-well-40 p-0 text-center text-faint"
                        >
                          ·
                        </td>
                      )
                    }
                    const overridden = row.relations[col.id]
                    const stance = overridden ?? row.defaultStance
                    const note = row.relationNotes?.[col.id] ?? ''
                    const cfg = STANCE_BADGE[stance]
                    const isCross = hoverCell?.row === row.id || hoverCell?.col === col.id

                    return (
                      <td
                        key={col.id}
                        onMouseEnter={() => setHoverCell({ row: row.id, col: col.id })}
                        onMouseLeave={() => setHoverCell(null)}
                        className={cn(
                          'h-9 w-9 border border-line/30 p-0.5 text-center',
                          isCross && 'bg-ink/[0.03]'
                        )}
                      >
                        <Popover
                          title={`${row.name} → ${col.name}`}
                          className="w-72 p-3 font-ui"
                          trigger={
                            <span
                              title={
                                note
                                  ? `${row.name} → ${col.name}: ${stance.toUpperCase()} — ${note}`
                                  : `${row.name} → ${col.name}: ${stance.toUpperCase()}`
                              }
                              className={cn(
                                'relative flex h-8 w-8 cursor-pointer items-center justify-center border font-data text-[9.5px] font-bold transition-all hover:brightness-125',
                                cfg.cls,
                                !overridden && 'opacity-60'
                              )}
                            >
                              <span>{SHORT_STANCE[stance]}</span>
                              {note && (
                                <span
                                  aria-hidden
                                  className="absolute right-0.5 top-0.5 h-1.5 w-1.5 bg-current"
                                />
                              )}
                            </span>
                          }
                        >
                          {() =>
                            readOnly || !onChangeRelation ? (
                              <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                  <span className={cn('border px-2 py-0.5 text-[10px] font-bold caps', cfg.cls)}>
                                    {stance}
                                  </span>
                                  {!overridden && (
                                    <span className="text-[10.5px] text-faint">(default posture)</span>
                                  )}
                                </div>
                                <p className="font-body text-[12px] leading-relaxed text-dim">
                                  {note || `${row.name} holds a ${stance} posture toward ${col.name}.`}
                                </p>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-2.5">
                                <div className="flex flex-wrap gap-1">
                                  {FACTION_STANCES.map((s) => (
                                    <button
                                      key={s}
                                      type="button"
                                      onClick={() => onChangeRelation(row, col.id, s, note)}
                                      className={cn(
                                        'border px-2 py-0.5 text-[10.5px] font-bold caps transition-colors cursor-pointer',
                                        stance === s ? STANCE_BADGE[s].cls : 'border-line/40 text-dim hover:text-ink'
                                      )}
                                    >
                                      {s}
                                    </button>
                                  ))}
                                  {overridden && (
                                    <button
                                      type="button"
                                      title="Reset to default stance"
                                      onClick={() => onChangeRelation(row, col.id, null, note)}
                                      className="ml-auto flex items-center gap-1 px-1.5 text-[10px] text-faint hover:text-alert cursor-pointer"
                                    >
                                      <RotateCcw className="h-3 w-3" />
                                      Default
                                    </button>
                                  )}
                                </div>
                                <Input
                                  value={note}
                                  placeholder={`Why ${row.name} feels this way…`}
                                  onChange={(e) => onChangeRelation(row, col.id, overridden ?? null, e.target.value)}
                                  className="h-8 select-text text-[12px]"
                                />
                              </div>
                            )
                          }
                        </Popover>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/**
 * Compact 2D matrix for a single faction's relations (Rows = other factions, Cols = stances).
 */
export function FactionStanceMatrix({
  factionName,
  defaultStance,
  otherFactions,
  relations,
  relationNotes,
  onSetStance,
  onSetNote
}: {
  factionName: string
  defaultStance: FactionStance
  otherFactions: StoredFaction[]
  relations: Record<string, FactionStance>
  relationNotes: Record<string, string>
  onSetStance: (targetId: string, stance: FactionStance | null) => void
  onSetNote: (targetId: string, note: string) => void
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-max border-collapse text-[11.5px]">
        <thead>
          <tr>
            <th className="w-40 border border-line/40 tone-well-60 px-2.5 py-1.5 text-left font-label text-[10px] caps-8 text-dim">
              Target Faction
            </th>
            {FACTION_STANCES.map((s) => (
              <th
                key={s}
                title={s}
                className="h-8 w-11 border border-line/40 tone-well-60 p-0 text-center font-data text-[10px] font-bold text-dim"
              >
                {SHORT_STANCE[s]}
              </th>
            ))}
            <th className="border border-line/40 tone-well-60 px-2.5 py-1.5 text-left font-label text-[10px] caps-8 text-dim">
              Why
            </th>
          </tr>
        </thead>
        <tbody>
          {otherFactions.map((target) => {
            const overridden = relations[target.id]
            const current = overridden ?? defaultStance
            const note = relationNotes[target.id] ?? ''
            return (
              <tr key={target.id} className="hover:tone-card-30">
                <td className="max-w-44 truncate border border-line/30 px-2.5 py-1 font-semibold text-ink">
                  {target.name}
                </td>
                {FACTION_STANCES.map((stance) => {
                  const active = current === stance
                  const cfg = STANCE_BADGE[stance]
                  return (
                    <td key={stance} className="h-9 w-11 border border-line/30 p-0.5 text-center">
                      <button
                        type="button"
                        onClick={() => onSetStance(target.id, stance)}
                        className={cn(
                          'flex h-8 w-10 items-center justify-center border font-data text-[10px] font-bold transition-colors cursor-pointer',
                          active
                            ? cn(cfg.cls, !overridden && 'opacity-70')
                            : 'border-transparent text-faint hover:border-line/40 hover:text-dim'
                        )}
                        title={
                          active && !overridden
                            ? `${stance} (from default)`
                            : `Set stance toward ${target.name} to ${stance}`
                        }
                      >
                        {active ? SHORT_STANCE[stance] : '·'}
                      </button>
                    </td>
                  )
                })}
                <td className="border border-line/30 p-0.5">
                  <Popover
                    align="end"
                    title={`${factionName || 'Faction'} → ${target.name}`}
                    className="w-72 p-3 font-ui"
                    trigger={
                      <span
                        title={note || 'Add reason'}
                        className={cn(
                          'inline-flex h-8 cursor-pointer items-center border px-2 text-[10.5px] transition-colors',
                          note
                            ? 'border-accent/50 bg-accent/10 text-ink'
                            : 'border-transparent text-faint hover:border-line/40 hover:text-dim'
                        )}
                      >
                        {note ? <span className="max-w-36 truncate">{note}</span> : <span>Add reason…</span>}
                      </span>
                    }
                  >
                    {(close) => (
                      <div className="flex flex-col gap-2.5">
                        <Input
                          autoFocus
                          value={note}
                          placeholder={`Why ${factionName || 'this faction'} feels this way…`}
                          onChange={(e) => onSetNote(target.id, e.target.value)}
                          className="h-8 select-text text-[12px]"
                        />
                        <div className="flex items-center justify-between">
                          {overridden ? (
                            <Button size="sm" variant="ghost" onClick={() => onSetStance(target.id, null)}>
                              Reset to default
                            </Button>
                          ) : (
                            <span />
                          )}
                          <Button size="sm" variant="primary" onClick={close}>
                            Done
                          </Button>
                        </div>
                      </div>
                    )}
                  </Popover>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
