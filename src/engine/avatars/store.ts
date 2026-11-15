import { noteFailure } from '../util/report'
import fs from 'node:fs'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import { isVaultLocked } from '@shared/sealed'
import { builtinAvatars, cleanAvatar, type Avatar, type AvatarInput } from '@shared/avatars'
import { dataRoot } from '../util/paths'
import { readJson, removePath, writeJson } from '../util/fs'
import { timeline } from '../timeline/store'

const DIR = path.join(dataRoot, 'avatars')

function slug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

class AvatarStore extends EventEmitter {
  private file(id: string): string {
    return path.join(DIR, `${id}.json`)
  }

  list(): Avatar[] {
    const builtins = builtinAvatars()
    const taken = new Set(builtins.map((a) => a.id))
    const out: Avatar[] = []
    if (fs.existsSync(DIR)) {
      for (const name of fs.readdirSync(DIR)) {
        if (!name.endsWith('.json')) continue
        try {
          const a = readJson<Avatar | null>(path.join(DIR, name), null)
          if (!a?.id || taken.has(a.id)) continue
          out.push({ ...a, ...cleanAvatar(a, a), id: a.id, builtin: false })
        } catch (err) {
          noteFailure(err, 'avatars', 'Could not read an avatar file')
          if (isVaultLocked(err)) return builtins
          continue
        }
      }
    }
    return [...builtins, ...out.sort((a, b) => a.name.localeCompare(b.name))]
  }

  find(ref: string): Avatar | null {
    const r = ref.trim().toLowerCase()
    return this.list().find((a) => a.id === ref || a.name.toLowerCase() === r || a.id === slug(ref)) ?? null
  }

  get(ref: string): Avatar {
    const a = this.find(ref)
    if (!a) throw new Error(`No avatar "${ref}". Avatars: ${this.list().map((x) => x.name).join(', ')}`)
    return a
  }

  save(input: AvatarInput): Avatar {
    const existing = input.id ? this.find(input.id) : input.name ? this.find(input.name) : null
    if (existing?.builtin) throw new Error(`${existing.name} is built in and can't be changed. Save a copy under a new name instead.`)
    const clean = cleanAvatar(input, existing)
    if (!clean.name) throw new Error('An avatar needs a name')
    const clash = this.list().find((a) => a.id !== existing?.id && a.name.toLowerCase() === clean.name.toLowerCase())
    if (clash) throw new Error(`There is already an avatar called ${clash.name}. Pick another name, or change that avatar instead.`)
    let id = existing?.id ?? (slug(clean.name) || `avatar-${Date.now().toString(36)}`)
    if (!existing) while (builtinAvatars().some((a) => a.id === id) || fs.existsSync(this.file(id))) id = `${id}-2`
    const now = Date.now()
    const avatar: Avatar = { ...clean, id, createdAt: existing?.createdAt ?? now, updatedAt: now }
    fs.mkdirSync(DIR, { recursive: true })
    writeJson(this.file(id), avatar)
    timeline.record({ kind: 'avatar', entry: id, action: existing ? 'changed' : 'made' })
    this.emit('changed', this.list())
    return avatar
  }

  delete(ref: string): void {
    const a = this.get(ref)
    if (a.builtin) throw new Error(`${a.name} is built in and can't be deleted`)
    removePath(this.file(a.id))
    timeline.forget('avatar', a.id)
    this.emit('changed', this.list())
  }
}

export const avatars = new AvatarStore()
