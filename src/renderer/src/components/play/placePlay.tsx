import { Dices, MessageSquare, Pencil, Signpost, Trash2 } from 'lucide-react'
import { parseActions, type Action } from '@shared/actions'
import { parseDecisions, type Decision } from '@shared/decisions'
import { editBlock } from '@shared/textBlocks'
import { PLACE_TYPE_KEY, type WorldEntity } from '@shared/world'
import { confirmDelete, type MenuItem } from '../ui'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { closePlay, showPlay, type PlayWhere } from './playStore'
import { PlayBuilder, type PlayKind } from './PlayBuilder'
import { decide, rollAction } from './play'

export interface PlacePlay {
  world: string
  placeKey: string
  place: WorldEntity
  character: string | null
  where: PlayWhere
}

const FIELD: Record<PlayKind, 'Actions' | 'Decisions'> = { action: 'Actions', decision: 'Decisions' }
const COUNTS: Record<PlayKind, (block: string) => boolean> = { action: (b) => parseActions(b).length > 0, decision: (b) => parseDecisions(b).length > 0 }
const textOf = (p: PlacePlay, kind: PlayKind) => (typeof p.place[FIELD[kind]] === 'string' ? String(p.place[FIELD[kind]]) : '')

function save(p: PlacePlay, kind: PlayKind, index: number | null, block: string | null): Promise<unknown> {
  return engine('worlds.put', { id: p.world, type: PLACE_TYPE_KEY, key: p.placeKey, entity: { [FIELD[kind]]: editBlock(textOf(p, kind), COUNTS[kind], index, block) } }).catch(failed('Could not save it'))
}

function builder(p: PlacePlay, kind: PlayKind, index: number | null, initial: { action?: Action; decision?: Decision }): void {
  showPlay(index === null ? `New ${kind}` : `Edit ${kind}`, <PlayBuilder kind={kind} {...initial} character={p.character} where={p.where} keepLabel={index === null ? 'Keep on this place' : 'Save'} onKeep={(k, block) => void save(p, k, index, block).then(closePlay)} />)
}

export function placePlay(world: string, placeKey: string, place: WorldEntity, character: string | null, agents: string[]): PlacePlay {
  return { world, placeKey, place, character, where: { link: `@world:${world}/place/${placeKey}`, agents } }
}

export function newPlayItems(p: PlacePlay): MenuItem[] {
  return [
    { label: 'New action', icon: <Dices />, onSelect: () => builder(p, 'action', null, {}) },
    { label: 'New decision', icon: <Signpost />, onSelect: () => builder(p, 'decision', null, {}) }
  ]
}

const editItems = (p: PlacePlay, kind: PlayKind, index: number, title: string, initial: { action?: Action; decision?: Decision }): MenuItem[] => [
  { label: 'Edit', icon: <Pencil />, onSelect: () => builder(p, kind, index, initial) },
  { label: 'Delete', icon: <Trash2 />, danger: true, onSelect: () => confirmDelete(`Delete "${title}"?`, 'It comes off this place.', () => save(p, kind, index, null)) }
]

export function actionItems(p: PlacePlay, action: Action, index: number): MenuItem[] {
  return [{ label: 'Roll', icon: <Dices />, onSelect: () => rollAction(action, action.by ? null : p.character, p.where) }, ...editItems(p, 'action', index, action.attempt, { action })]
}

export function decisionItems(p: PlacePlay, decision: Decision, index: number, deciderName: string | null): MenuItem[] {
  return [{ label: deciderName ? `Ask ${deciderName}` : 'Decide', icon: deciderName ? <MessageSquare /> : <Signpost />, onSelect: () => decide(decision, p.where) }, ...editItems(p, 'decision', index, decision.question, { decision })]
}

