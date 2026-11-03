import { Star } from 'lucide-react'
import type { TrayPin } from '@shared/types'
import type { MenuItem } from '../components/ui'
import { useApp } from '../store/app'

const NONE: TrayPin[] = []

const keyOf = (p: { kind: string; id: string | null }) => `${p.kind}/${p.id ?? ''}`

export function useFavourites(): TrayPin[] {
  return useApp((s) => s.settings?.favourites ?? NONE)
}

function isFavourite(kind: string, id: string): boolean {
  return (useApp.getState().settings?.favourites ?? []).some((p) => keyOf(p) === keyOf({ kind, id }))
}

export function toggleFavourite(pin: TrayPin): void {
  const app = useApp.getState()
  const list = app.settings?.favourites ?? []
  const next = list.some((p) => keyOf(p) === keyOf(pin)) ? list.filter((p) => keyOf(p) !== keyOf(pin)) : [...list, pin]
  void app.updateSettings({ favourites: next })
}

export function favouriteItem(pin: TrayPin & { id: string }): MenuItem {
  return { label: isFavourite(pin.kind, pin.id) ? 'Unfavourite' : 'Favourite', icon: <Star />, onSelect: () => toggleFavourite(pin) }
}
