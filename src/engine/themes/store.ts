import { noteFailure } from '../util/report'
import fs from 'node:fs'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { isVaultLocked } from '@shared/sealed'
import { DEFAULT_THEME_ID, NO_AMBIENCE, SEVEN_THEME, cleanAmbience, cleanTheme, type Ambience, type AmbienceCue, type Theme } from '@shared/theme'
import { dataRoot } from '../util/paths'
import { readJson, removePath, writeJson } from '../util/fs'
import { chatFiles } from '../sessions/access'
import { timeline } from '../timeline/store'
import { checkThemeFiles } from './pictures'

const AMBIENCE_FILE = 'ambience.json'

const DIR = path.join(dataRoot, 'themes')

function slug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

class ThemeStore extends EventEmitter {
  private file(id: string): string {
    return path.join(DIR, `${id}.json`)
  }

  list(): Theme[] {
    const out: Theme[] = [SEVEN_THEME]
    if (!fs.existsSync(DIR)) return out
    for (const name of fs.readdirSync(DIR)) {
      if (!name.endsWith('.json')) continue
      try {
        const t = readJson<Theme | null>(path.join(DIR, name), null)
        if (t?.id && t.id !== DEFAULT_THEME_ID) out.push({ ...t, ...cleanTheme(t, t), id: t.id, builtin: false })
      } catch (err) {
        noteFailure(err, 'themes', 'Could not read a theme file')
        if (isVaultLocked(err)) return [SEVEN_THEME]
        continue
      }
    }
    return out.sort((a, b) => (a.builtin ? -1 : b.builtin ? 1 : a.name.localeCompare(b.name)))
  }

  find(ref: string): Theme | null {
    const r = ref.trim().toLowerCase()
    return this.list().find((t) => t.id === ref || t.name.toLowerCase() === r || t.id === slug(ref)) ?? null
  }

  get(ref: string): Theme {
    const t = this.find(ref)
    if (!t) throw new Error(`No theme "${ref}". Themes: ${this.list().map((x) => x.name).join(', ')}`)
    return t
  }

  save(input: Omit<Partial<Theme>, 'id'> & { id?: string | null }): Theme {
    const existing = input.id ? this.find(input.id) : input.name ? this.find(input.name) : null
    if (existing?.builtin) throw new Error(`${existing.name} is built in and can't be changed. Save a copy under a new name instead (theme set to the new name, copy_of "${existing.name}").`)
    const clean = checkThemeFiles(cleanTheme(input, existing ?? SEVEN_THEME))
    if (!existing && !input.name?.trim()) throw new Error('A new theme needs a name')
    const clash = this.list().find((t) => t.id !== existing?.id && t.name.toLowerCase() === clean.name.toLowerCase())
    if (clash) throw new Error(`There is already a theme called ${clash.name}. Pick another name, or change that theme instead.`)
    let id = existing?.id ?? (slug(clean.name) || `theme-${Date.now().toString(36)}`)
    if (!existing) while (id === DEFAULT_THEME_ID || fs.existsSync(this.file(id))) id = `${id}-2`
    const now = Date.now()
    const theme: Theme = { ...clean, id, createdBy: existing ? (existing.createdBy ?? null) : (clean.createdBy ?? null), createdAt: existing?.createdAt ?? now, updatedAt: now }
    fs.mkdirSync(DIR, { recursive: true })
    writeJson(this.file(id), theme)
    timeline.record({ kind: 'theme', entry: id, action: existing ? 'changed' : 'made' })
    this.emit('changed', this.list())
    return theme
  }

  delete(ref: string): void {
    const t = this.get(ref)
    if (t.builtin) throw new Error(`${t.name} is built in and can't be deleted`)
    removePath(this.file(t.id))
    timeline.forget('theme', t.id)
    this.emit('deleted', t.id)
    this.emit('changed', this.list())
  }

  ambience(sessionId: string): Ambience {
    try {
      return cleanAmbience(chatFiles(sessionId).readJson<unknown>(AMBIENCE_FILE, null))
    } catch (err) {
      if (isVaultLocked(err)) return NO_AMBIENCE
      throw err
    }
  }

  setAmbience(sessionId: string, patch: Partial<Ambience> | null, minutes: number | null = null): Ambience {
    const current = this.ambience(sessionId)
    const next = patch === null ? NO_AMBIENCE : cleanAmbience({ ...current, ...patch, until: minutes ? Date.now() + Math.min(240, Math.max(1, minutes)) * 60_000 : null })
    chatFiles(sessionId).writeJson(AMBIENCE_FILE, next)
    this.emit('ambience', sessionId, next)
    return next
  }

  cue(cue: AmbienceCue): void {
    this.emit('cue', cue)
  }
}

export const themes = new ThemeStore()
