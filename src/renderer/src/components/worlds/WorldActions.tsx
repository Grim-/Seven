import { useState } from 'react'
import { BookmarkPlus, Dices, Signpost, Swords } from 'lucide-react'
import type { WorldMeta } from '@shared/world'
import { parseActions, type Action } from '@shared/actions'
import { parseDecisions, type Decision } from '@shared/decisions'
import { Button, EmptyState, ShellTabs } from '../ui'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { failed } from '../../lib/notify'
import { toast } from '../../store/toasts'
import { rollAction, decide } from '../play/play'
import { worldWhere } from '../play/playStore'

interface Props {
  world: WorldMeta
}

export function WorldActions({ world }: Props) {
  const [subTab, setSubTab] = useState<'actions' | 'decisions'>('actions')

  // Load places and map uses to collect all inline actions and decisions
  const places = useLive(() => engine('worlds.records', { id: world.id, type: 'place' }), 'worlds.changed') ?? {}
  const uses = useLive(() => engine('worlds.maps', { id: world.id }), 'worlds.changed') ?? []

  // Extract all actions
  const allActions: { action: Action; source: string; placeKey?: string }[] = []
  const allDecisions: { decision: Decision; source: string; placeKey?: string }[] = []

  for (const [key, p] of Object.entries(places)) {
    const actText = typeof p.Actions === 'string' ? p.Actions : ''
    const decText = typeof p.Decisions === 'string' ? p.Decisions : ''
    const name = typeof p.Name === 'string' ? p.Name : key

    for (const a of parseActions(actText)) {
      allActions.push({ action: a, source: `Place: ${name}`, placeKey: key })
    }
    for (const d of parseDecisions(decText)) {
      allDecisions.push({ decision: d, source: `Place: ${name}`, placeKey: key })
    }
  }

  // Also check standing tokens
  for (const u of uses) {
    for (const [sheet, standing] of Object.entries(u.stand)) {
      for (const a of parseActions(standing.actions)) {
        allActions.push({ action: a, source: `Character: ${sheet} on ${u.map}` })
      }
      for (const d of parseDecisions(standing.decisions)) {
        allDecisions.push({ decision: d, source: `Character: ${sheet} on ${u.map}` })
      }
    }
  }

  const handleSaveActionToLibrary = async (a: Action) => {
    try {
      await engine('storyActions.save', {
        action: {
          id: a.attempt.toLowerCase().replace(/\s+/g, '_').slice(0, 30),
          name: a.attempt,
          action: a,
          tags: ['world', world.name.toLowerCase()]
        },
        previousId: null
      })
      toast.success('Saved to Library', `Action "${a.attempt}" is now a reusable story action in your library!`)
    } catch (err) {
      failed('Could not save to library')(err)
    }
  }

  const handleSaveDecisionToLibrary = async (d: Decision) => {
    try {
      await engine('decisions.save', {
        decision: {
          id: d.question.toLowerCase().replace(/\s+/g, '_').slice(0, 30),
          name: d.question,
          mode: 'pick',
          die: 6,
          count: d.options.length || 2,
          roller: 'player',
          prompt: '',
          options: d.options.map((opt) => ({ text: opt.text, roll: { type: 'none' as const } })),
          tags: ['world', world.name.toLowerCase()]
        },
        previousId: null
      })
      toast.success('Saved to Library', `Decision "${d.question}" is now a reusable decision in your library!`)
    } catch (err) {
      failed('Could not save to library')(err)
    }
  }

  const where = worldWhere(null, [], world.id, world.player)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 font-ui select-none">
      {/* HEADER & TABS */}
      <div className="flex items-center justify-between border-b border-line pb-2.5">
        <div className="flex items-center gap-3">
          <Swords className="h-4 w-4 text-secondary-ink" />
          <span className="text-[12px] font-bold caps-5 text-ink">
            WORLD ACTIONS &amp; DECISIONS
          </span>
          <ShellTabs
            value={subTab}
            onChange={setSubTab}
            options={[
              { value: 'actions', label: `Actions (${allActions.length})` },
              { value: 'decisions', label: `Decisions (${allDecisions.length})` }
            ]}
          />
        </div>
      </div>

      {/* CONTENT */}
      {subTab === 'actions' ? (
        allActions.length === 0 ? (
          <EmptyState title="No actions defined in this world yet">
            Actions can be attached to places, objects, and characters to define check DC difficulty and outcomes.
          </EmptyState>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {allActions.map(({ action: a, source }, idx) => (
              <div
                key={idx}
                className="flex flex-col justify-between border border-line/60 tone-well-60 p-3 hover:border-line"
              >
                <div>
                  <div className="text-[13px] font-bold text-ink truncate">
                    {a.attempt}
                  </div>
                  <div className="mt-0.5 text-[10px] text-faint truncate">
                    {source}
                  </div>

                  {/* CHECKS */}
                  <div className="mt-2 flex flex-col gap-1 text-[11px] text-dim">
                    {a.checks.map((c, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <span className="text-secondary-ink">{c.against ?? 'Check'}:</span>
                        <span>DC {c.base ?? 10}</span>
                      </div>
                    ))}
                  </div>

                  {/* OUTCOMES */}
                  <div className="mt-2 flex flex-col gap-0.5 text-[10.5px]">
                    {a.pass && <div className="text-ok truncate">Pass: {a.pass}</div>}
                    {a.fail && <div className="text-alert truncate">Fail: {a.fail}</div>}
                  </div>
                </div>

                {/* ACTIONS */}
                <div className="mt-3 flex items-center justify-between border-t border-line/40 pt-2 text-[10.5px]">
                  <Button
                    size="sm"
                    variant="badge"
                    icon={<Dices className="h-3 w-3" />}
                    onClick={() => rollAction(a, world.player, where)}
                    className="h-6 text-[10px] px-2"
                  >
                    Test Roll
                  </Button>

                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<BookmarkPlus className="h-3 w-3" />}
                    onClick={() => void handleSaveActionToLibrary(a)}
                    className="h-6 text-[10px] px-2"
                    title="Save to Library as reusable Action Kind"
                  >
                    Save to Lib
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        allDecisions.length === 0 ? (
          <EmptyState title="No decisions defined in this world yet">
            Decisions can be attached to places, objects, and characters to present roleplay options or rolled choices.
          </EmptyState>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {allDecisions.map(({ decision: d, source }, idx) => (
              <div
                key={idx}
                className="flex flex-col justify-between border border-line/60 tone-well-60 p-3 hover:border-line"
              >
                <div>
                  <div className="text-[13px] font-bold text-ink truncate">
                    {d.question}
                  </div>
                  <div className="mt-0.5 text-[10px] text-faint truncate">
                    {source}
                  </div>

                  {/* OPTIONS */}
                  <div className="mt-2 flex flex-col gap-1 text-[10.5px] text-dim">
                    {d.options.map((opt, i) => (
                      <div key={i} className="truncate">
                        • {opt.text}
                      </div>
                    ))}
                  </div>
                </div>

                {/* ACTIONS */}
                <div className="mt-3 flex items-center justify-between border-t border-line/40 pt-2 text-[10.5px]">
                  <Button
                    size="sm"
                    variant="badge"
                    icon={<Signpost className="h-3 w-3" />}
                    onClick={() => decide(d, where)}
                    className="h-6 text-[10px] px-2"
                  >
                    Test Choice
                  </Button>

                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<BookmarkPlus className="h-3 w-3" />}
                    onClick={() => void handleSaveDecisionToLibrary(d)}
                    className="h-6 text-[10px] px-2"
                    title="Save to Library as reusable Decision Kind"
                  >
                    Save to Lib
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
