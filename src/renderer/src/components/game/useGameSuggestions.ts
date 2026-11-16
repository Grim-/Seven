import { useMemo } from 'react'
import { BUFF_TEMPLATES, CLASS_TEMPLATES, ITEM_TEMPLATES, TRAIT_TEMPLATES } from '@shared/game/defs'
import { engine } from '../../lib/ipc'
import { noteFailure } from '../../store/problems'
import { useLive } from '../../lib/useLive'
import { useGameDefs } from './useGameDefs'

const collectTags = (list: { values: Record<string, unknown> }[] | null | undefined, out: Set<string>): void => {
  for (const def of list ?? []) {
    const raw = def.values.tags
    if (Array.isArray(raw)) {
      for (const t of raw) {
        const clean = String(t ?? '').trim()
        if (clean) out.add(clean)
      }
    }
    const rewards = def.values.rewards
    if (Array.isArray(rewards)) {
      for (const r of rewards) {
        if (r && typeof r === 'object' && Array.isArray((r as { tags?: unknown }).tags)) {
          for (const t of (r as { tags: unknown[] }).tags) {
            const clean = String(t ?? '').trim()
            if (clean) out.add(clean)
          }
        }
      }
    }
  }
}

export function useKnownGameTags(): string[] {
  const traits = useGameDefs(TRAIT_TEMPLATES).list
  const classes = useGameDefs(CLASS_TEMPLATES).list
  const buffs = useGameDefs(BUFF_TEMPLATES).list
  const items = useGameDefs(ITEM_TEMPLATES).list
  return useMemo(() => {
    const out = new Set<string>()
    collectTags(traits, out)
    collectTags(classes, out)
    collectTags(buffs, out)
    collectTags(items, out)
    return [...out].sort()
  }, [traits, classes, buffs, items])
}

export function useKnownWorldFlags(): { id: string; world: string }[] {
  return (
    useLive(async () => {
      const worlds = await engine('worlds.list').catch(noteFailure('worlds', 'Could not list worlds', () => []))
      const out = new Map<string, string>()
      for (const w of worlds) {
        const [flags, maps] = await Promise.all([
          engine('worlds.flags', { id: w.id }).catch(noteFailure('worlds', 'Could not read world flags', () => ({}))),
          engine('worlds.maps', { id: w.id }).catch(noteFailure('worlds', 'Could not read world maps', () => []))
        ])
        for (const k of Object.keys(flags)) out.set(k, w.name)
        for (const u of maps) {
          for (const t of u.triggers ?? []) {
            if (t.needsFlag) out.set(t.needsFlag, w.name)
            if (t.hiddenIfFlag) out.set(t.hiddenIfFlag, w.name)
            if (t.setsFlag) out.set(t.setsFlag, w.name)
          }
          for (const g of Object.values(u.layerGating ?? {})) {
            if (g.needsFlag) out.set(g.needsFlag, w.name)
            if (g.hiddenIfFlag) out.set(g.hiddenIfFlag, w.name)
          }
          for (const g of Object.values(u.propGating ?? {})) {
            if (g.needsFlag) out.set(g.needsFlag, w.name)
            if (g.hiddenIfFlag) out.set(g.hiddenIfFlag, w.name)
          }
        }
      }
      return [...out.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([id, world]) => ({ id, world }))
    }, 'worlds.changed') ?? []
  )
}
