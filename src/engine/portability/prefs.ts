import fs from 'node:fs'
import path from 'node:path'
import { DEFAULT_PORTABILITY_PREFS, cleanPortabilityPrefs, type PortabilityPrefs } from '@shared/portability'
import { dataRoot } from '../util/paths'
import { noteFailure } from '../util/report'

export function readPortabilityPrefs(): PortabilityPrefs {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(dataRoot, 'settings.json'), 'utf8')) as { portability?: unknown }
    return cleanPortabilityPrefs(raw.portability)
  } catch (err) {
    noteFailure(err, 'portability', 'Could not read portability settings')
    return DEFAULT_PORTABILITY_PREFS
  }
}
