import type { ReactNode } from 'react'
import type { CardField, CardLayout, CardValue, Place } from '@shared/cards'
import { ShellFace } from '../ui'
import { AssetMedia } from '../pictures/AssetMedia'
import { Drawing } from '../chat/Drawing'

function shown(value: CardValue | undefined): string {
  if (value === null || value === undefined) return ''
  return Array.isArray(value) ? value.join(', ') : String(value)
}

function artOf(field: CardField | undefined, value: CardValue | undefined, art: string | null): ReactNode {
  if (field && typeof value === 'string' && value) return field.type === 'picture' ? <AssetMedia id={value} className="h-full w-full" /> : value
  if (art) return art.startsWith('<svg') ? <Drawing source={art} className="my-0 max-h-full" /> : art
  return undefined
}

export function CardFace({ name, label, layout, values, color, art = null, className }: { name: string; label?: string; layout: CardLayout; values: Record<string, CardValue>; color?: string | null; art?: string | null; className?: string }) {
  const at = (place: Place) => layout.fields.filter((f) => f.place === place && shown(values[f.id]))
  const texts = (place: Place) => at(place).map((f) => shown(values[f.id]))
  const titled = texts('title')
  const artField = layout.fields.find((f) => f.place === 'art')
  const rows = at('rows').flatMap((f) => {
    const v = values[f.id]
    return Array.isArray(v) ? v : [shown(v)]
  })
  const body = [...texts('body'), ...rows]
  return (
    <ShellFace
      title={titled.length ? titled.join(' ') : name}
      label={label}
      tags={texts('badge_left')}
      marks={texts('badge_right')}
      aside={layout.name || undefined}
      art={artOf(artField, artField ? values[artField.id] : undefined, art)}
      type={texts('type_line').join(' · ') || undefined}
      body={body.length ? body.join('\n') : undefined}
      stats={at('bar').map((f) => ({ key: f.id, label: f.label, value: shown(values[f.id]) }))}
      foot={at('footer').map((f) => `${f.label} ${shown(values[f.id])}`).join(' · ') || undefined}
      corners={[texts('badge_left'), texts('badge_right')]}
      color={color ?? layout.color}
      frame={layout.frame}
      className={className}
    />
  )
}
