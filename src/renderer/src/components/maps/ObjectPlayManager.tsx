import { useState } from 'react'
import {
  Dices,
  Edit2,
  Plus,
  Signpost,
  Trash2
} from 'lucide-react'
import {
  actionText,
  parseActions,
  type Action
} from '@shared/actions'
import {
  decisionText,
  parseDecisions,
  type Decision
} from '@shared/decisions'
import { NO_SWAP } from '@shared/cardDecks'
import type { StoredAction } from '@shared/storedAction'
import type { StoredDecision } from '@shared/storedDecision'
import { ActionForm, BLANK_ACTION } from '../play/ActionForm'
import { DecisionForm, BLANK_DECISION } from '../play/DecisionForm'
import { Button, Modal, Select } from '../ui'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { toast } from '../../store/toasts'

interface ObjectPlayManagerProps {
  actionsText: string
  decisionsText: string
  onChangeActions: (text: string) => void
  onChangeDecisions: (text: string) => void
  world?: string
  character?: string | null
}

const DUMMY_WHERE = { link: null, agents: [] }

export function ObjectPlayManager({
  actionsText,
  decisionsText,
  onChangeActions,
  onChangeDecisions,
  character = null
}: ObjectPlayManagerProps) {
  // Query reusable actions and decisions from the library
  const libraryActions: StoredAction[] =
    useLive(() => engine('storyActions.list', {}), 'storyActions.changed') ?? []
  const libraryDecisions: StoredDecision[] =
    useLive(() => engine('decisions.list', {}), 'decisions.changed') ?? []

  // Parse current structured actions and decisions
  const actions = parseActions(actionsText)
  const decisions = parseDecisions(decisionsText)

  // Modal editor states
  const [editingActionIndex, setEditingActionIndex] = useState<number | null>(null)
  const [editingDecisionIndex, setEditingDecisionIndex] = useState<number | null>(null)
  const [isBuildingNewAction, setIsBuildingNewAction] = useState(false)
  const [isBuildingNewDecision, setIsBuildingNewDecision] = useState(false)

  // Save actions array back to serialized text
  const updateActions = (nextActions: Action[]) => {
    const text = nextActions.map(actionText).join('\n\n')
    onChangeActions(text)
  }

  // Save decisions array back to serialized text
  const updateDecisions = (nextDecisions: Decision[]) => {
    const text = nextDecisions.map(decisionText).join('\n\n')
    onChangeDecisions(text)
  }

  const handleDeleteAction = (index: number) => {
    updateActions(actions.filter((_, i) => i !== index))
  }

  const handleDeleteDecision = (index: number) => {
    updateDecisions(decisions.filter((_, i) => i !== index))
  }

  const handlePickLibraryAction = (stored: StoredAction) => {
    updateActions([...actions, stored.action])
  }

  const handlePickLibraryDecision = (stored: StoredDecision) => {
    const converted: Decision = {
      question: stored.prompt || stored.name,
      options: stored.options.map((opt) => ({ text: opt.text, cards: NO_SWAP, action: opt.action ?? null })),
      own: false,
      decider: stored.mode === 'roll' ? 'die' : null
    }
    updateDecisions([...decisions, converted])
  }

  return (
    <div className="flex flex-col gap-4 font-mono select-none">
      {/* ──────────────────────────────────────────────────────────── */}
      {/* ACTIONS SECTION */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between border-b border-line/40 pb-1">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-accent uppercase">
            <Dices className="h-3.5 w-3.5 text-accent" />
            <span>Interactive Actions (Checks &amp; Attempts)</span>
          </div>
          <span className="text-[9.5px] text-faint">{actions.length} Configured</span>
        </div>

        {/* ACTIONS LIST */}
        <div className="flex flex-col gap-1.5">
          {actions.length === 0 ? (
            <div className="border border-dashed border-line/40 bg-black/30 p-2.5 text-center text-[10.5px] text-faint">
              No rollable actions configured yet.
            </div>
          ) : (
            actions.map((act, i) => (
              <div
                key={i}
                className="flex items-center justify-between border border-line/60 bg-black/60 p-2 hover:border-accent/60 transition-colors"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[11.5px] font-bold text-white truncate">
                      {act.attempt}
                    </span>
                    <span className="border border-line/60 bg-line/20 px-1 text-[8.5px] uppercase text-cyan">
                      {act.needs}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[9.5px] text-dim">
                    {act.checks.map((c, ci) => (
                      <span key={ci} className="border border-line/40 bg-black/40 px-1 text-accent">
                        {c.against ?? 'Chance'} DC {c.difficulty ?? 10}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-1 ml-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditingActionIndex(i)}
                    title="Edit action check"
                    className="p-1 text-dim hover:text-cyan transition-colors"
                  >
                    <Edit2 className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteAction(i)}
                    title="Delete action"
                    className="p-1 text-dim hover:text-alert transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ACTION TOOLBAR: BUILD NEW OR PICK FROM LIBRARY */}
        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            variant="ghost"
            icon={<Plus className="h-3 w-3 text-accent" />}
            onClick={() => setIsBuildingNewAction(true)}
            className="flex-1 text-[10px] border border-accent/40 hover:bg-accent/10"
          >
            Build Action
          </Button>

          {libraryActions.length > 0 && (
            <div className="relative flex flex-1">
              <Select
                value=""
                options={[
                  { value: '', label: '+ Library Action...' },
                  ...libraryActions.map((la) => ({ value: la.id, label: la.name }))
                ]}
                onChange={(val) => {
                  const found = libraryActions.find((a) => a.id === val)
                  if (found) handlePickLibraryAction(found)
                }}
                className="h-7 text-[10px]"
              />
            </div>
          )}
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* DECISIONS SECTION */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 border-t border-line/40 pt-3">
        <div className="flex items-center justify-between border-b border-line/40 pb-1">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-cyan uppercase">
            <Signpost className="h-3.5 w-3.5 text-cyan" />
            <span>Interactive Decisions (Player Choices)</span>
          </div>
          <span className="text-[9.5px] text-faint">{decisions.length} Configured</span>
        </div>

        {/* DECISIONS LIST */}
        <div className="flex flex-col gap-1.5">
          {decisions.length === 0 ? (
            <div className="border border-dashed border-line/40 bg-black/30 p-2.5 text-center text-[10.5px] text-faint">
              No interactive choices configured yet.
            </div>
          ) : (
            decisions.map((dec, i) => (
              <div
                key={i}
                className="flex items-center justify-between border border-line/60 bg-black/60 p-2 hover:border-cyan/60 transition-colors"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[11.5px] font-bold text-white truncate">
                      {dec.question}
                    </span>
                    <span className="border border-cyan/40 bg-cyan/15 px-1 text-[8.5px] text-cyan">
                      {dec.decider ? `Agent: ${dec.decider}` : 'You Decide'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[9.5px] text-dim truncate">
                    {dec.options.map((opt, oi) => (
                      <span key={oi} className="border border-line/30 bg-black/40 px-1">
                        {opt.text}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-1 ml-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditingDecisionIndex(i)}
                    title="Edit decision"
                    className="p-1 text-dim hover:text-cyan transition-colors"
                  >
                    <Edit2 className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteDecision(i)}
                    title="Delete decision"
                    className="p-1 text-dim hover:text-alert transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* DECISION TOOLBAR: BUILD NEW OR PICK FROM LIBRARY */}
        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            variant="ghost"
            icon={<Plus className="h-3 w-3 text-cyan" />}
            onClick={() => setIsBuildingNewDecision(true)}
            className="flex-1 text-[10px] border border-cyan/40 hover:bg-cyan/10"
          >
            Build Decision
          </Button>

          {libraryDecisions.length > 0 && (
            <div className="relative flex flex-1">
              <Select
                value=""
                options={[
                  { value: '', label: '+ Library Decision...' },
                  ...libraryDecisions.map((ld) => ({ value: ld.id, label: ld.name }))
                ]}
                onChange={(val) => {
                  const found = libraryDecisions.find((d) => d.id === val)
                  if (found) handlePickLibraryDecision(found)
                }}
                className="h-7 text-[10px]"
              />
            </div>
          )}
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* ACTION BUILDER / EDITOR MODAL */}
      {/* ──────────────────────────────────────────────────────────── */}
      {(isBuildingNewAction || editingActionIndex !== null) && (
        <Modal
          open={true}
          title={isBuildingNewAction ? 'Build New Rollable Action' : 'Edit Rollable Action'}
          onClose={() => {
            setIsBuildingNewAction(false)
            setEditingActionIndex(null)
          }}
          wide
        >
          <div className="p-4 font-mono select-none">
            <ActionForm
              initial={
                editingActionIndex !== null
                  ? actions[editingActionIndex] ?? BLANK_ACTION
                  : BLANK_ACTION
              }
              character={character}
              where={DUMMY_WHERE}
              keepLabel="Apply Action to Object"
              onKeep={(text, actionObj) => {
                const actionToApply = actionObj ?? parseActions(text)[0]
                if (actionToApply) {
                  if (editingActionIndex !== null) {
                    const next = [...actions]
                    next[editingActionIndex] = actionToApply
                    updateActions(next)
                    toast.success('Action Updated', `Updated "${actionToApply.attempt}".`)
                  } else {
                    updateActions([...actions, actionToApply])
                    toast.success('Action Applied', `Applied "${actionToApply.attempt}" to object.`)
                  }
                }
                setIsBuildingNewAction(false)
                setEditingActionIndex(null)
              }}
            />
          </div>
        </Modal>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* DECISION BUILDER / EDITOR MODAL */}
      {/* ──────────────────────────────────────────────────────────── */}
      {(isBuildingNewDecision || editingDecisionIndex !== null) && (
        <Modal
          open={true}
          title={isBuildingNewDecision ? 'Build New Decision' : 'Edit Decision'}
          onClose={() => {
            setIsBuildingNewDecision(false)
            setEditingDecisionIndex(null)
          }}
          wide
        >
          <div className="p-4 font-mono select-none">
            <DecisionForm
              initial={
                editingDecisionIndex !== null
                  ? decisions[editingDecisionIndex] ?? BLANK_DECISION
                  : BLANK_DECISION
              }
              where={DUMMY_WHERE}
              keepLabel="Apply Decision to Object"
              onKeep={(text, decisionObj) => {
                const decisionToApply = decisionObj ?? parseDecisions(text)[0]
                if (decisionToApply) {
                  if (editingDecisionIndex !== null) {
                    const next = [...decisions]
                    next[editingDecisionIndex] = decisionToApply
                    updateDecisions(next)
                    toast.success('Decision Updated', `Updated "${decisionToApply.question}".`)
                  } else {
                    updateDecisions([...decisions, decisionToApply])
                    toast.success('Decision Applied', `Applied "${decisionToApply.question}" to object.`)
                  }
                }
                setIsBuildingNewDecision(false)
                setEditingDecisionIndex(null)
              }}
            />
          </div>
        </Modal>
      )}
    </div>
  )
}
