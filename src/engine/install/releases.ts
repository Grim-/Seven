import type { InstallChoice } from '@shared/types'
import { helperOf, type Choice, type StoredRelease } from './registry'
import { change, record, settingsOf } from './store'
import { installEvents } from './events'

const refreshing = new Map<string, Promise<void>>()

export function refreshReleases(id: string): Promise<void> {
  const running = refreshing.get(id)
  if (running) return running
  const work = (async () => {
    const list = await helperOf(id).releases(settingsOf(id), new AbortController().signal)
    change(id, (r) => {
      r.releases = list
      r.checkedAt = Date.now()
    })
    installEvents.changed(id)
  })().finally(() => refreshing.delete(id))
  refreshing.set(id, work)
  return work
}

export function checkIfDue(id: string, hours: number): void {
  const at = record(id).checkedAt
  if (hours > 0 && (at === null || Date.now() - at > hours * 3_600_000)) void refreshReleases(id).catch(() => undefined)
}

export function releaseOf(id: string, tag: string): StoredRelease {
  const found = record(id).releases.find((r) => r.tag === tag)
  if (!found) throw new Error(`Release ${tag} isn't in the list Seven has. Check for updates, then pick it again.`)
  return found
}

export function choicesFor(id: string, tag: string): Promise<Choice[]> {
  return helperOf(id).choices(releaseOf(id, tag), settingsOf(id))
}

export async function choiceViews(id: string, tag: string): Promise<InstallChoice[]> {
  return (await choicesFor(id, tag)).map((c) => ({ build: c.build, label: c.label, size: c.size, unavailable: c.unavailable, notes: c.notes, files: c.files }))
}
