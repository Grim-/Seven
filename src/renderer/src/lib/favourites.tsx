import { Star } from 'lucide-react'
import { showName } from '@shared/ids'
import type { TrayPin } from '@shared/types'
import type { MenuItem } from '../components/ui'
import { kindUi } from '../registries/kinds'
import { useApp } from '../store/app'
import { cn } from './cn'
import { openEntry, showInData } from './library'
import { engine } from './ipc'
import { noteFailure } from '../store/problems'
import { failed } from './notify'

const NONE: TrayPin[] = []

export const favouriteKey = (p: { kind: string; id: string | null }): string => `${p.kind}/${p.id ?? ''}`

export function isFileFavouriteKind(kind: string): boolean {
  return kind === 'file' || kindUi(kind).ownView === 'pages'
}

export function useFavourites(): TrayPin[] {
  return useApp((s) => s.settings?.favourites ?? NONE)
}

export function dropFavourites(gone: (pin: TrayPin) => boolean): void {
  const app = useApp.getState()
  const list = app.settings?.favourites ?? []
  const kept = list.filter((p) => !gone(p))
  if (kept.length !== list.length) void app.updateSettings({ favourites: kept }).catch(failed('Could not remove a deleted favourite'))
}

export function isFavourite(kind: string, id: string | null): boolean {
  return (useApp.getState().settings?.favourites ?? []).some((p) => favouriteKey(p) === favouriteKey({ kind, id }))
}

export function useIsFavourite(kind: string, id: string | null): boolean {
  return useApp((s) => (s.settings?.favourites ?? NONE).some((p) => favouriteKey(p) === favouriteKey({ kind, id })))
}

export function toggleFavourite(pin: TrayPin): void {
  const app = useApp.getState()
  const list = app.settings?.favourites ?? []
  const next = list.some((p) => favouriteKey(p) === favouriteKey(pin)) ? list.filter((p) => favouriteKey(p) !== favouriteKey(pin)) : [...list, pin]
  void app.updateSettings({ favourites: next })
}

export function favouriteItem(pin: TrayPin): MenuItem {
  return { label: isFavourite(pin.kind, pin.id) ? 'Unfavourite' : 'Favourite', icon: <Star />, onSelect: () => toggleFavourite(pin) }
}

export function whenFavouriteExists(pin: TrayPin, go: () => void): void {
  void engine('library.has', { kind: pin.kind, id: pin.id })
    .then((exists) => {
      if (exists) go()
      else dropFavourites((p) => favouriteKey(p) === favouriteKey(pin))
    })
    .catch(noteFailure('library', 'Could not open the favourite'))
}

export function openFavourite(pin: TrayPin): void {
  whenFavouriteExists(pin, () => {
    if (pin.id) openEntry(pin.kind, pin.id)
    else showInData({ kind: pin.kind, id: 'all' })
  })
}

const SIZES = {
  xs: { btn: 'h-5 w-5 ml-1', icon: 'h-3.5 w-3.5' },
  sm: { btn: 'h-7 w-7', icon: 'h-3.5 w-3.5' },
  md: { btn: 'h-8 w-8', icon: 'h-4 w-4' }
} as const

export function FavouriteButton({
  pin,
  size = 'sm',
  title,
  className
}: {
  pin: TrayPin
  size?: keyof typeof SIZES
  title?: string
  className?: string
}) {
  const starred = useIsFavourite(pin.kind, pin.id)
  const spec = SIZES[size]
  return (
    <button
      type="button"
      title={title ?? (starred ? 'Unfavourite' : `Favourite ${showName(pin.label)}`)}
      onClick={() => toggleFavourite(pin)}
      className={cn(
        'flex shrink-0 items-center justify-center transition-colors',
        spec.btn,
        starred ? 'text-accent hover:text-ink' : 'text-dim hover:text-accent',
        className
      )}
    >
      <Star className={cn(spec.icon, starred && 'fill-accent')} />
    </button>
  )
}
