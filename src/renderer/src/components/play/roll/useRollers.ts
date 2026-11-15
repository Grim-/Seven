import { useMemo } from 'react'
import { checkTargets, findTarget } from '@shared/actions'
import type { DndStats } from '@shared/dnd'
import { engine } from '../../../lib/ipc'
import { useLibraryData, useLive } from '../../../lib/useLive'
import type { Roller } from './WhoRolls'

interface SheetInfo {
  id: string
  title: string
  image: string | null
  dnd: DndStats | null
}

interface WorldInfo {
  id: string
  player?: string | null
}

export function useRollers(
  against: string | null,
  options: { preferred?: string | null; world?: string | null } = {}
): {
  rollers: Roller[]
  eligible: Roller[]
} {
  const sheets = useLibraryData(() => engine('sheets.list'), 'sheets.changed') as SheetInfo[] | null
  const worlds = useLive(() => engine('worlds.list'), 'worlds.changed') as WorldInfo[] | null

  return useMemo(() => {
    if (!sheets || !sheets.length) return { rollers: [], eligible: [] }

    const activeWorld = options.world ? worlds?.find((w) => w.id === options.world) : null
    const worldPlayer = activeWorld?.player ?? null
    const preferred = options.preferred ?? null

    const list: Roller[] = sheets.map((s) => {
      const targets = checkTargets(s)
      const found = against ? findTarget(targets, against) : null
      const bonus = against ? (found?.bonus ?? null) : 0

      let priority = 2
      let note: string | undefined

      if (preferred && s.id === preferred) {
        priority = 0
        note = "Agent's choice"
      } else if (worldPlayer && s.id === worldPlayer) {
        priority = 0
        note = 'Your character'
      }

      return {
        sheet: s.id,
        name: s.title,
        image: s.image,
        bonus,
        note,
        priority
      }
    })

    const eligible = list.filter((r) => r.bonus !== null)
    return { rollers: list, eligible }
  }, [sheets, worlds, against, options.preferred, options.world])
}
