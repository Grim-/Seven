import { FOLDER_TYPE } from '@shared/ids'
import type { SaveFolderAnswer, SaveFolderRow } from '@shared/saveFolders'
import { USER, kinds, kindNamed, type Kind } from '../library/kinds'
import { data } from './hub'
import { saveFolders } from './saveFolders'
import { placeTarget, placeTargets, type PlaceTarget } from './placeTargets'

export function homeOf(kind: Kind): string | null {
  return kind.home !== undefined ? kind.home : kind.plural
}

function placed(kind: Kind | undefined): kind is Kind {
  const types = kind?.pageTypes ?? []
  return types.length > 0 && !types.includes(FOLDER_TYPE)
}

function kindTarget(kind: Kind): PlaceTarget {
  return { target: kind.kind, label: kind.plural, home: homeOf(kind), asks: true }
}

function targetOf(target: string): PlaceTarget | null {
  const own = placeTarget(target)
  if (own) return own
  const kind = kindNamed(target)
  return placed(kind) ? kindTarget(kind) : null
}

export function placeRows(): SaveFolderRow[] {
  const all = saveFolders.all()
  return [...kinds(USER).filter(placed).map(kindTarget), ...placeTargets()].map((t) => ({
    target: t.target,
    label: t.label,
    home: t.home,
    asks: t.asks,
    folder: all[t.target]?.folder ?? null,
    ask: t.asks && (all[t.target]?.ask ?? true)
  }))
}

export function placeAnswer(target: string): SaveFolderAnswer {
  const t = targetOf(target)
  const place = saveFolders.get(target)
  return { target, label: t?.label ?? target, folder: place?.folder ?? t?.home ?? '', ask: Boolean(t?.asks) && (place?.ask ?? true) }
}

export function placeFile(tool: string | null, fallback: string | null): string | null {
  return tool && placeTarget(tool) ? placeIn(tool, fallback) : fallback
}

export function placeIn(target: string, fallback: string | null): string | null {
  const place = saveFolders.get(target)
  if (place && place.folder !== null) return place.folder ? data.pages.makeFolders(place.folder) : null
  if (fallback) return fallback
  const home = targetOf(target)?.home
  return home ? data.pages.makeFolders(home) : null
}
