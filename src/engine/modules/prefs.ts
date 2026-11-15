import path from 'node:path'
import type { ToolsPrefs } from '@shared/types'
import { dataRoot } from '../util/paths'
import { readJson, writeJson } from '../util/fs'

const FILE = path.join(dataRoot, 'tools-prefs.json')

function defaults(): ToolsPrefs {
  return { toolsFolder: path.join(dataRoot, 'tools'), skillsFolder: path.join(dataRoot, 'skills'), zipLimitMb: 200 }
}

let current: ToolsPrefs = { ...defaults(), ...readJson<Partial<ToolsPrefs>>(FILE, {}) }

export function getToolsPrefs(): ToolsPrefs {
  return { ...current }
}

export function saveToolsPrefs(next: ToolsPrefs): void {
  current = { ...next }
  writeJson(FILE, current)
}
