import { noteFailure } from '../util/report'
import path from 'node:path'
import type { UserIdentity } from '@shared/types'
import { dataRoot } from '../util/paths'
import { readJson, writeJson } from '../util/fs'
import { data } from '../data/hub'

const FILE = path.join(dataRoot, 'you.json')
const MAX_NAME = 60
const MAX_ABOUT = 4000

export const PROFILE_PAGE = 'user_profile'

export function profileLink(): string {
  const found = data.pages.find(PROFILE_PAGE, (p) => !p.type)
  return `@page:${found ? data.pages.pathOf(found.id) : PROFILE_PAGE}`
}

class Identity {
  get(): UserIdentity {
    try {
      const raw = readJson<Partial<UserIdentity>>(FILE, {})
      return { name: String(raw.name ?? ''), about: String(raw.about ?? '') }
    } catch (err) {
      noteFailure(err, 'profile', 'Could not read your profile')
      return { name: '', about: '' }
    }
  }

  set(input: UserIdentity): UserIdentity {
    const value: UserIdentity = { name: String(input.name ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME), about: String(input.about ?? '').trim().slice(0, MAX_ABOUT) }
    writeJson(FILE, value)
    return value
  }
}

export const identity = new Identity()

export function userSection(): string {
  const { name, about } = identity.get()
  const lines = ['## The user']
  lines.push(name ? `You're talking to ${name}, who owns this Seven. When they say "I", "me" or "my", they mean ${name}.` : "You're talking to the person who owns this Seven.")
  lines.push(`Their profile page is ${profileLink()}; when they say "my profile", they mean that page.`)
  if (about) lines.push('', `What ${name || 'they'} want${name ? 's' : ''} every agent to know:`, about)
  return lines.join('\n')
}
