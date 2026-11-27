import { useMemo, useState } from 'react'
import { Calendar, Check, Copy, MapPin, MessageSquare, Newspaper, Plus, Trash2, Users } from 'lucide-react'
import {
  broadsheetEditionMarkdown,
  buildBroadsheetEdition,
  worldTimeFromSeconds,
  type Almanac,
  type BroadsheetDispatch,
  type BroadsheetEdition
} from '@shared/almanac'
import { Button, Eyebrow, Input, Textarea } from '../ui'
import { withReferences } from '../chat/References'
import { cn } from '../../lib/cn'

interface Props {
  almanac: Almanac
  catchUpPackText: string
  catchUpTokens: number
  checkedCount: number
  onSaveEditions: (editions: BroadsheetEdition[]) => void
  onStartSceneChat: () => void
}

function DispatchCard({ dispatch, lead }: { dispatch: BroadsheetDispatch; lead?: boolean }) {
  return (
    <article
      className={cn(
        'flex min-w-0 flex-col gap-2 overflow-hidden',
        lead
          ? 'border-b border-line/50 pb-4 lg:border-b-0 lg:border-r lg:pr-6'
          : 'border border-line/40 tone-panel-45 p-3.5'
      )}
    >
      {dispatch.kicker && (
        <div className="flex flex-wrap items-center gap-1 font-label text-[10px] font-semibold caps-5 text-accent break-words">
          {withReferences(dispatch.kicker)}
        </div>
      )}
      <h3
        className={cn(
          'font-display font-bold leading-tight text-ink break-words',
          lead ? 'text-[22px] sm:text-[26px]' : 'text-[15.5px]'
        )}
      >
        {dispatch.headline}
      </h3>
      <div
        className={cn(
          'font-prose leading-relaxed text-ink/90 whitespace-pre-wrap break-words',
          lead ? 'text-[14px]' : 'text-[12.5px]'
        )}
      >
        {withReferences(dispatch.body)}
      </div>
      {dispatch.outcome && (
        <div className="border-l-2 border-accent/60 bg-accent/5 px-2.5 py-1.5 font-ui text-[11.5px] text-dim break-words">
          <span className="font-semibold text-ink">Outcome: </span>
          {withReferences(dispatch.outcome)}
        </div>
      )}
      {dispatch.who.length > 0 && (
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 pt-1 font-ui text-[10.5px] text-faint">
          <Users className="h-3 w-3 shrink-0" />
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
            {dispatch.who.map((w, i) => (
              <span key={`${w}-${i}`} className="inline-flex max-w-full items-center">
                {withReferences(w)}
              </span>
            ))}
          </div>
        </div>
      )}
    </article>
  )
}

export function BroadsheetView({
  almanac,
  catchUpPackText,
  catchUpTokens,
  checkedCount,
  onSaveEditions,
  onStartSceneChat
}: Props) {
  const currentDay = worldTimeFromSeconds(almanac.currentTime, 1).day
  const editions = almanac.editions ?? []

  const [selectedId, setSelectedId] = useState<string | null>(editions[0]?.id ?? null)
  const [dayFrom, setDayFrom] = useState<number>(Math.max(1, currentDay - 2))
  const [dayTo, setDayTo] = useState<number>(currentDay)
  const [customTitle, setCustomTitle] = useState('')
  const [showRawPack, setShowRawPack] = useState(false)
  const [copied, setCopied] = useState(false)

  const activeEdition = useMemo(
    () => editions.find((e) => e.id === selectedId) ?? editions[0] ?? null,
    [editions, selectedId]
  )

  const printEdition = (from = dayFrom, to = dayTo, title = customTitle) => {
    const ed = buildBroadsheetEdition(almanac, { dayFrom: from, dayTo: to, title })
    const next = [ed, ...editions]
    onSaveEditions(next)
    setSelectedId(ed.id)
    setCustomTitle('')
    setShowRawPack(false)
  }

  const deleteEdition = (id: string) => {
    const next = editions.filter((e) => e.id !== id)
    onSaveEditions(next)
    if (selectedId === id) setSelectedId(next[0]?.id ?? null)
  }

  const copyText = activeEdition && !showRawPack ? broadsheetEditionMarkdown(almanac, activeEdition) : catchUpPackText

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4 p-5 font-ui">
      {/* PRESS CONTROLS: PICK TIME RANGE -> PRINT EDITION */}
      <div className="flex flex-col gap-3 border border-line/50 tone-panel-60 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Newspaper className="h-4 w-4 text-accent" />
            <Eyebrow className="text-ink">Broadsheet Press — Editions</Eyebrow>
            <span className="text-[11px] text-dim">
              Pick any day range to print a catch-up edition (public chronicle only; secrets excluded).
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowRawPack((v) => !v)}
            >
              {showRawPack ? 'Read Broadsheet' : `Raw Pack (~${catchUpTokens}t)`}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={copied ? <Check /> : <Copy />}
              onClick={() => {
                void navigator.clipboard.writeText(copyText)
                setCopied(true)
                setTimeout(() => setCopied(false), 1800)
              }}
            >
              {copied ? 'Copied' : 'Copy Markdown'}
            </Button>
            <Button size="sm" variant="primary" icon={<MessageSquare />} onClick={onStartSceneChat}>
              Start Scene Chat
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2 border-t border-line/35 pt-2.5">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-dim" />
            <span className="text-[11px] text-dim">Days</span>
            <Input
              type="number"
              min={1}
              value={String(dayFrom)}
              onChange={(e) => setDayFrom(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
              className="h-7 w-16 text-center text-[12px]"
            />
            <span className="text-[11px] text-faint">to</span>
            <Input
              type="number"
              min={1}
              value={String(dayTo)}
              onChange={(e) => setDayTo(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
              className="h-7 w-16 text-center text-[12px]"
            />
          </div>

          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDayFrom(currentDay)
                setDayTo(currentDay)
              }}
            >
              Today (Day {currentDay})
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDayFrom(Math.max(1, currentDay - 2))
                setDayTo(currentDay)
              }}
            >
              Last 3 Days
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDayFrom(1)
                setDayTo(currentDay)
              }}
            >
              All Days
            </Button>
          </div>

          <Input
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            placeholder="Optional edition title…"
            className="h-7 min-w-[160px] flex-1 text-[12px]"
          />

          <Button size="sm" variant="primary" icon={<Plus />} onClick={() => printEdition()}>
            Print Edition
          </Button>
        </div>

        {/* SAVED EDITIONS SHELF */}
        {editions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-line/35 pt-2">
            <span className="text-[10.5px] caps-5 text-faint mr-1">Editions:</span>
            {editions.map((ed) => {
              const active = !showRawPack && activeEdition?.id === ed.id
              return (
                <div
                  key={ed.id}
                  className={cn(
                    'group flex items-center border transition-colors',
                    active ? 'border-accent bg-accent/15 text-ink' : 'border-line/45 tone-well-60 text-dim hover:border-line hover:text-ink'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(ed.id)
                      setShowRawPack(false)
                    }}
                    className="cursor-pointer px-2.5 py-1 text-[11px]"
                  >
                    <span className="font-semibold">No. {ed.editionNumber}</span> · {ed.title}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteEdition(ed.id)}
                    title={`Delete Edition No. ${ed.editionNumber}`}
                    className="cursor-pointer pr-1.5 text-faint hover:text-alert"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* BODY: RAW PACK OR BROADSHEET READER */}
      {showRawPack ? (
        <div className="flex flex-col gap-2">
          <div className="text-[11.5px] text-dim">
            {checkedCount > 0
              ? `Staged Catch-Up Pack (${checkedCount} selected scenes) — reference @almanac:${almanac.id}#public in chat.`
              : `Live Public Chronicle (@almanac:${almanac.id}#public).`}
          </div>
          <Textarea value={catchUpPackText} readOnly rows={20} className="font-ui text-xs" />
        </div>
      ) : !activeEdition ? (
        <div className="flex flex-col items-center justify-center gap-3 border border-line/45 tone-panel-45 px-6 py-12 text-center">
          <Newspaper className="h-8 w-8 text-accent/80" />
          <div className="font-display text-[18px] font-bold text-ink">No Broadsheet Editions Printed Yet</div>
          <p className="max-w-md text-[12.5px] text-dim">
            Pick a day range above and click <strong>Print Edition</strong> to generate a catch-up broadsheet from your almanac’s public chronicle.
          </p>
          <Button size="sm" variant="primary" icon={<Plus />} onClick={() => printEdition(1, currentDay)}>
            Print Edition (Days 1–{currentDay})
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-5 border border-line/60 tone-panel-85 p-6 shadow-sm">
          {/* MASTHEAD */}
          <header className="flex flex-col items-center gap-1.5 border-y-2 border-line/70 py-3 text-center">
            <div className="flex w-full flex-wrap items-center justify-between gap-2 font-label text-[10px] caps-5 text-dim">
              <span>Edition No. {activeEdition.editionNumber}</span>
              <span>
                {activeEdition.dayFrom === activeEdition.dayTo
                  ? `Day ${activeEdition.dayFrom}`
                  : `Days ${activeEdition.dayFrom} – ${activeEdition.dayTo}`}
              </span>
              <span>Current Clock: Day {currentDay}</span>
            </div>
            <h2 className="font-display text-[26px] font-bold tracking-wide text-ink sm:text-[32px]">
              {activeEdition.masthead || `${almanac.title} Broadsheet`}
            </h2>
            <div className="text-[11.5px] text-dim">
              <span className="font-semibold text-secondary-ink">{activeEdition.title}</span>
              {activeEdition.subtitle ? ` — ${activeEdition.subtitle}` : ''}
            </div>
          </header>

          {/* LEAD STORY + SIDE BULLETIN */}
          {activeEdition.lead ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="min-w-0 lg:col-span-8">
                <DispatchCard dispatch={activeEdition.lead} lead />
              </div>
              <aside className="flex min-w-0 flex-col gap-4 lg:col-span-4">
                {activeEdition.threads.length > 0 && (
                  <div className="min-w-0 border border-line/45 tone-well-40 p-3.5">
                    <Eyebrow className="mb-2 text-secondary-ink">Word on the Street</Eyebrow>
                    <ul className="flex flex-col gap-2 text-[12px]">
                      {activeEdition.threads.map((t, i) => (
                        <li key={i} className="border-b border-line/25 pb-1.5 break-words last:border-b-0 last:pb-0">
                          <span className="font-label text-[9.5px] caps-5 text-accent">[{t.kind}] </span>
                          <span className="text-ink/90">
                            {withReferences(t.text)}
                          </span>
                          {t.where && (
                            <span className="ml-1 text-[11px] text-faint">
                              ({withReferences(t.where)})
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {(activeEdition.places.length > 0 || activeEdition.figures.length > 0) && (
                  <div className="min-w-0 overflow-hidden border border-line/45 tone-well-40 p-3.5 text-[11.5px]">
                    <Eyebrow className="mb-2 text-dim">In This Edition</Eyebrow>
                    {activeEdition.places.length > 0 && (
                      <div className="mb-2.5 flex min-w-0 items-start gap-1.5 text-dim">
                        <MapPin className="mt-1 h-3.5 w-3.5 shrink-0 text-accent" />
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                          {activeEdition.places.map((p, i) => (
                            <span key={`${p}-${i}`} className="inline-flex max-w-full flex-wrap items-center">
                              {withReferences(p)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {activeEdition.figures.length > 0 && (
                      <div className="flex min-w-0 items-start gap-1.5 text-dim">
                        <Users className="mt-1 h-3.5 w-3.5 shrink-0 text-secondary-ink" />
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                          {activeEdition.figures.map((fig, i) => (
                            <span key={`${fig}-${i}`} className="inline-flex max-w-full flex-wrap items-center">
                              {withReferences(fig)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </aside>
            </div>
          ) : (
            <div className="py-8 text-center text-[13px] text-faint">
              No public chronicle entries were recorded during{' '}
              {activeEdition.dayFrom === activeEdition.dayTo
                ? `Day ${activeEdition.dayFrom}`
                : `Days ${activeEdition.dayFrom}–${activeEdition.dayTo}`}
              .
            </div>
          )}

          {/* SECONDARY DISPATCHES GRID */}
          {activeEdition.dispatches.length > 0 && (
            <div className="border-t border-line/50 pt-4">
              <Eyebrow className="mb-3 text-dim">Further Dispatches</Eyebrow>
              <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3">
                {activeEdition.dispatches.map((d) => (
                  <DispatchCard key={d.id} dispatch={d} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
