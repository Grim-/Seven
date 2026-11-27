import { FONT_ROLES, type FontRole, type LookFont } from '@shared/themeLook'
import type { Theme } from '@shared/theme'
import { noteFailure } from '../../../store/problems'
import { cssUrl, present, registerSkinSection, type AssetUrl } from './registry'

const loaded = new Map<string, Promise<boolean>>()

function faceName(theme: Theme, role: FontRole): string {
  return `seven-theme-${theme.id}-${role}`
}

function load(theme: Theme, role: FontRole, url: AssetUrl): Promise<boolean> {
  const file = theme.fonts[role]?.file
  const src = file ? cssUrl(url(file)) : null
  if (!file || !src) return Promise.resolve(false)
  const key = `${faceName(theme, role)}:${file}`
  const known = loaded.get(key)
  if (known) return known
  const face = new FontFace(faceName(theme, role), src)
  const done = face.load().then(
    (f) => (document.fonts.add(f), true),
    (err: unknown) => (noteFailure('themes', `Could not load the ${role} font of ${theme.name}`)(err), false)
  )
  loaded.set(key, done)
  return done
}

function stack(theme: Theme, role: FontRole, withFace: boolean): string | undefined {
  const font = theme.fonts[role]
  if (!font) return undefined
  return withFace ? `"${faceName(theme, role)}", ${font.family}` : font.family
}

const ready = new Map<string, boolean>()

registerSkinSection({
  assets: (theme) => FONT_ROLES.flatMap((r) => (theme.fonts[r]?.file ? [theme.fonts[r]!.file!] : [])),
  load: async (theme, url) => {
    await Promise.all(FONT_ROLES.map(async (r) => ready.set(`${theme.id}:${r}`, await load(theme, r, url))))
  },
  vars: (theme) => present(Object.fromEntries(FONT_ROLES.map((r) => [`--font-${r}`, stack(theme, r, ready.get(`${theme.id}:${r}`) ?? false)]))),
  read: (read) => ({
    fonts: Object.fromEntries(
      FONT_ROLES.flatMap((r): [string, LookFont][] => {
        const family = read.value(`--font-${r}`)
        return family ? [[r, { family, file: null }]] : []
      })
    )
  })
})
