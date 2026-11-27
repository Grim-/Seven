import { useState } from 'react'
import { Plus, Zap } from 'lucide-react'
import { newTrigger, triggerTypes, type TriggerDef, type TriggerType } from '@shared/game/triggers'
import type { Point } from '@shared/shapes'
import { Button, Input, ListRow, Modal } from '../ui'
import { TabbedBody } from './TabbedBody'
import { triggerTabs } from './triggerTabs'

interface Props {
  world?: string
  at: Point
  onClose: () => void
  onPlaced: (trigger: TriggerDef) => void
}

const SIZE = 64

const made = (type: TriggerType, at: Point): TriggerDef => newTrigger(type, { kind: 'box', x: Math.round(at.x - SIZE / 2), y: Math.round(at.y - SIZE / 2), w: SIZE, h: SIZE })

export function AddTriggerModal({ world = '', at, onClose, onPlaced }: Props) {
  const types = triggerTypes()
  const [draft, setDraft] = useState<TriggerDef | null>(() => (types[0] ? made(types[0], at) : null))

  const pick = (type: TriggerType) => setDraft(made(type, at))
  const place = () => {
    if (!draft) return
    onPlaced({ ...draft, name: draft.name.trim() || (types.find((t) => t.type === draft.type)?.label ?? draft.name) })
    onClose()
  }

  return (
    <Modal open={true} title={`Place a trigger at ${Math.round(at.x)}, ${Math.round(at.y)}`} onClose={onClose} wide>
      <div className="grid h-[min(70vh,560px)] grid-cols-1 gap-3 font-ui lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="flex min-h-0 flex-col overflow-y-auto border border-line tone-panel-40">
          {types.map((t) => (
            <ListRow
              key={t.type}
              active={draft?.type === t.type}
              onClick={() => pick(t)}
              icon={<Zap className="h-3.5 w-3.5 text-accent" />}
              title={t.label}
              subtitle={t.description}
              meta={t.fires === 'enter' ? 'step in' : 'click'}
            />
          ))}
        </div>
        {draft && (
          <div className="flex min-h-0 flex-col border border-line tone-panel-60">
            <div className="border-b border-line/60 p-2">
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Name" />
            </div>
            <TabbedBody place="addTrigger" tabs={triggerTabs(draft, world, setDraft)} />
            <div className="flex items-center justify-end gap-2 border-t border-line/60 p-2">
              <Button size="sm" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" icon={<Plus className="h-3.5 w-3.5" />} onClick={place}>
                Place trigger
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
