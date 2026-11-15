import type { ReactNode } from 'react'
import type { CardField, CardLayout, CardValue, Place } from '@shared/cards'
import { ShellFace, type FaceEdit, type FaceSlot } from '../ui'
import { cn } from '../../lib/cn'
import { AssetMedia } from '../pictures/AssetMedia'
import { Drawing } from '../chat/Drawing'
import { Markdown } from '../chat/Markdown'

export type CardSlot = Exclude<Place, 'none'>

export const SLOT_OF: Record<CardSlot, FaceSlot> = {
  title: 'title',
  badge_left: 'tags',
  badge_right: 'marks',
  art: 'art',
  type_line: 'type',
  body: 'body',
  rows: 'body',
  bar: 'stats',
  footer: 'foot'
}

const SLOTS = Object.keys(SLOT_OF) as CardSlot[]

export const placeFor = (slot: FaceSlot): CardSlot => SLOTS.find((p) => SLOT_OF[p] === slot) ?? 'body'

export const inSlot = (f: CardField, slot: FaceSlot) => f.place !== 'none' && SLOT_OF[f.place] === slot

function shown(value: CardValue | undefined): string {
  if (value === null || value === undefined) return ''
  return Array.isArray(value) ? value.join(', ') : String(value)
}

function artOf(field: CardField | undefined, value: CardValue | undefined, art: string | null): ReactNode {
  if (field && typeof value === 'string' && value) return field.type === 'picture' ? <AssetMedia id={value} className="h-full w-full" /> : value
  if (art) return art.startsWith('<svg') ? <Drawing source={art} className="my-0 max-h-full" /> : art
  return undefined
}

export function CardFace({ name, label, layout, values, color, art = null, prompt = '', sections, edit, className }: { name: string; label?: string; layout: CardLayout; values: Record<string, CardValue>; color?: string | null; art?: string | null; prompt?: string; sections?: ReactNode; edit?: FaceEdit; className?: string }) {
  const at = (place: Place) => layout.fields.filter((f) => f.place === place && shown(values[f.id]))
  const texts = (place: Place) => at(place).map((f) => shown(values[f.id]))
  const titled = texts('title')
  const artField = layout.fields.find((f) => f.place === 'art')
  const rows = at('rows').flatMap((f) => {
    const v = values[f.id]
    return Array.isArray(v) ? v : [shown(v)]
  })
  const flavour = [...texts('body'), ...rows].join('\n')
  const said = prompt.trim()
  const body =
    flavour || said ? (
      <>
        {flavour && <Markdown text={flavour} className="italic text-dim" />}
        {said && <Markdown text={said} className={cn(flavour && 'mt-1.5')} />}
      </>
    ) : undefined
  return (
    <ShellFace
      title={titled.length ? titled.join(' ') : name}
      label={label}
      tags={texts('badge_left')}
      marks={texts('badge_right')}
      aside={layout.name || undefined}
      art={artOf(artField, artField ? values[artField.id] : undefined, art)}
      type={texts('type_line').join(' · ') || undefined}
      body={body}
      sections={sections}
      stats={at('bar').map((f) => ({ key: f.id, label: f.label, value: shown(values[f.id]) }))}
      foot={at('footer').map((f) => `${f.label} ${shown(values[f.id])}`).join(' · ') || undefined}
      color={color ?? layout.color}
      edit={edit}
      className={cn('card-face', className)}
    />
  )
}
