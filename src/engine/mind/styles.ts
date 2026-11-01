import fs from 'node:fs'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import type { ReasoningStyle, StyleVoice } from '@shared/types'
import { dataRoot } from '../util/paths'
import { newId, readJson, writeJson } from '../util/fs'

const FILE = path.join(dataRoot, 'reasoning-styles.json')

const STARTERS: ReasoningStyle[] = [
  { id: 'plain', name: 'Plain', instruction: 'Think it through step by step. Question your assumptions, then decide.', voices: [], updatedAt: 0 },
  {
    id: 'green-room',
    name: 'Green room',
    instruction: 'The voices argue briefly, each for its own view, and point out the flaws in the others. Then the Director weighs them and settles it.',
    voices: [
      { label: 'Optimist', line: 'Looks for what could go right and argues for acting.' },
      { label: 'Sceptic', line: 'Doubts every claim and looks for what could go wrong.' },
      { label: 'Pragmatist', line: 'Cares only about what works right now.' }
    ],
    updatedAt: 0
  }
]

function cleanVoices(input: unknown): StyleVoice[] {
  if (!Array.isArray(input)) return []
  return input
    .map((v) => ({ label: String((v as StyleVoice)?.label ?? '').trim().slice(0, 60), line: String((v as StyleVoice)?.line ?? '').trim().slice(0, 300) }))
    .filter((v) => v.label)
    .slice(0, 8)
}

class Styles extends EventEmitter {
  list(): ReasoningStyle[] {
    return fs.existsSync(FILE) ? readJson<ReasoningStyle[]>(FILE, []) : STARTERS
  }

  find(ref: string): ReasoningStyle | null {
    const key = ref.trim().toLowerCase()
    return this.list().find((s) => s.id === ref.trim() || s.name.toLowerCase() === key) ?? null
  }

  private write(list: ReasoningStyle[]): void {
    writeJson(FILE, list)
    this.emit('changed', list)
  }

  save(input: { id: string | null; name: string; instruction: string; voices: StyleVoice[] }): ReasoningStyle {
    const name = input.name.trim().slice(0, 60)
    if (!name) throw new Error('A reasoning style needs a name')
    const instruction = input.instruction.trim().slice(0, 1200)
    if (!instruction) throw new Error('Say how this style reasons')
    const list = this.list()
    if (list.some((s) => s.id !== input.id && s.name.toLowerCase() === name.toLowerCase())) throw new Error(`There is already a reasoning style called ${name}. Give this one a different name.`)
    const style: ReasoningStyle = { id: input.id && list.some((s) => s.id === input.id) ? input.id : newId('style'), name, instruction, voices: cleanVoices(input.voices), updatedAt: Date.now() }
    this.write(list.some((s) => s.id === style.id) ? list.map((s) => (s.id === style.id ? style : s)) : [...list, style])
    return style
  }

  delete(id: string): boolean {
    const list = this.list()
    if (!list.some((s) => s.id === id)) return false
    this.write(list.filter((s) => s.id !== id))
    return true
  }
}

export const styles = new Styles()
