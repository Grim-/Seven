import { useEffect, useState } from 'react'
import type { Ability } from '@shared/game/components'
import { readStored, writeStored } from '../../../lib/stored'

export const ACTION_DRAG_MIME = 'application/x-seven-action'
export const ACTION_SLOT_SWAP_MIME = 'application/x-seven-action-slot'

export interface ActionSlotAbility {
  kind: 'ability'
  uid: string
  id: string
  label: string
}

export interface ActionSlotItem {
  kind: 'item'
  uid: string
  id: string
  label: string
}

export type ActionSlotDef = ActionSlotAbility | ActionSlotItem

export interface ActionDragPayload {
  kind: 'ability' | 'item'
  uid: string
  id: string
  label: string
}

export function setCompactDragGhost(
  e: React.DragEvent | DragEvent,
  label: string,
  accentColor: string = '#66fcf1'
): void {
  const ghost = document.createElement('div')
  const initials = label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')

  ghost.style.position = 'fixed'
  ghost.style.top = '-9999px'
  ghost.style.left = '-9999px'
  ghost.style.width = '46px'
  ghost.style.height = '46px'
  ghost.style.background = '#06090e'
  ghost.style.border = `2px solid ${accentColor}`
  ghost.style.boxShadow = `0 0 16px ${accentColor}88`
  ghost.style.color = '#f1f7f9'
  ghost.style.fontFamily = 'monospace'
  ghost.style.fontSize = '13px'
  ghost.style.fontWeight = 'bold'
  ghost.style.display = 'flex'
  ghost.style.alignItems = 'center'
  ghost.style.justifyContent = 'center'
  ghost.style.letterSpacing = '-0.05em'
  ghost.style.pointerEvents = 'none'
  ghost.style.zIndex = '99999'
  ghost.innerText = initials || '??'

  document.body.appendChild(ghost)
  if (e.dataTransfer) {
    e.dataTransfer.setDragImage(ghost, 23, 23)
  }
  setTimeout(() => {
    if (ghost.parentNode) ghost.parentNode.removeChild(ghost)
  }, 0)
}

const STORAGE_KEY = 'seven:action_slots:v1'
const EVENT_NAME = 'seven:action_slots:changed'

function loadAllSlots(): Record<string, (ActionSlotDef | null)[]> {
  return readStored<Record<string, (ActionSlotDef | null)[]>>(STORAGE_KEY, {})
}

function saveAllSlots(data: Record<string, (ActionSlotDef | null)[]>): void {
  writeStored(STORAGE_KEY, data)
  window.dispatchEvent(new CustomEvent(EVENT_NAME))
}

export const DEFAULT_TOTAL_SLOTS = 48

export function getActionSlots(
  sheet: string,
  defaultAbilities?: Ability[],
  totalSlots = DEFAULT_TOTAL_SLOTS
): (ActionSlotDef | null)[] {
  const all = loadAllSlots()
  if (all[sheet] && Array.isArray(all[sheet])) {
    const list = all[sheet]
    return Array.from({ length: totalSlots }, (_, i) => list[i] ?? null)
  }
  // Default to first abilities if available
  const initial: (ActionSlotDef | null)[] = Array.from({ length: totalSlots }, (_, i) => {
    const a = defaultAbilities?.[i]
    if (!a) return null
    return {
      kind: 'ability',
      uid: a.uid,
      id: a.id,
      label: String(a.params.label || a.id)
    }
  })
  return initial
}

export function setActionSlot(
  sheet: string,
  index: number,
  def: ActionSlotDef,
  totalSlots = DEFAULT_TOTAL_SLOTS
): void {
  if (index < 0 || index >= totalSlots) return
  const all = loadAllSlots()
  const current = getActionSlots(sheet, undefined, totalSlots)
  current[index] = def
  all[sheet] = current
  saveAllSlots(all)
}

export function clearActionSlot(
  sheet: string,
  index: number,
  totalSlots = DEFAULT_TOTAL_SLOTS
): void {
  if (index < 0 || index >= totalSlots) return
  const all = loadAllSlots()
  const current = getActionSlots(sheet, undefined, totalSlots)
  current[index] = null
  all[sheet] = current
  saveAllSlots(all)
}

export function swapActionSlots(
  sheet: string,
  fromIndex: number,
  toIndex: number,
  totalSlots = DEFAULT_TOTAL_SLOTS
): void {
  if (
    fromIndex < 0 ||
    fromIndex >= totalSlots ||
    toIndex < 0 ||
    toIndex >= totalSlots ||
    fromIndex === toIndex
  )
    return
  const all = loadAllSlots()
  const current = getActionSlots(sheet, undefined, totalSlots)
  const temp = current[fromIndex]
  current[fromIndex] = current[toIndex]
  current[toIndex] = temp
  all[sheet] = current
  saveAllSlots(all)
}

export function useActionSlots(
  sheet: string | null | undefined,
  defaultAbilities?: Ability[],
  totalSlots = DEFAULT_TOTAL_SLOTS
): (ActionSlotDef | null)[] {
  const [slots, setSlots] = useState<(ActionSlotDef | null)[]>(() =>
    sheet
      ? getActionSlots(sheet, defaultAbilities, totalSlots)
      : Array.from({ length: totalSlots }, () => null)
  )

  useEffect(() => {
    if (!sheet) {
      setSlots(Array.from({ length: totalSlots }, () => null))
      return
    }

    const update = () => {
      setSlots(getActionSlots(sheet, defaultAbilities, totalSlots))
    }

    update()
    window.addEventListener(EVENT_NAME, update)
    return () => window.removeEventListener(EVENT_NAME, update)
  }, [sheet, defaultAbilities, totalSlots])

  return slots
}
