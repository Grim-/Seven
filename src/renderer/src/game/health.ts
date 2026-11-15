import type { CharacterSheet } from '@shared/types'
import { engine } from '../lib/ipc'
import { moduleOn } from '../lib/moduleOn'
import { healthWriters, type HealthChange } from '../components/chat/status/characterStatus'

export async function changeHealth(sheetId: string, delta: number): Promise<HealthChange | null> {
  const sheet: CharacterSheet = await engine('sheets.get', { id: sheetId })
  for (const writer of healthWriters.on(moduleOn)) {
    const done = writer.change(sheet, delta)
    if (done) return done
  }
  return null
}
