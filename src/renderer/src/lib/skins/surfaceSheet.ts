import type { Theme } from '@shared/theme'
import { isTopLevel, mapStyleValues, styleCss, type SurfaceStyle } from '@shared/themeLook'
import { reportFailure } from '../../store/problems'

const ASSET_URL = /url\(\s*(['"]?)(a_[a-z0-9]+)\1\s*\)/g

type AssetUrl = (id: string) => string | null

function withAssets(value: string, url: AssetUrl): string {
  return value.replace(ASSET_URL, (_whole, _quote: string, id: string) => {
    const found = url(id)
    return found ? `url(${JSON.stringify(found)})` : 'none'
  })
}

export function surfaceAssets(theme: Theme): string[] {
  const ids: string[] = []
  for (const style of Object.values(theme.surfaces))
    mapStyleValues(style, (v) => {
      for (const m of v.matchAll(ASSET_URL)) ids.push(m[2])
      return v
    })
  return ids
}

function surfaceSheet(theme: Theme, id: string, style: SurfaceStyle, url: AssetUrl): CSSStyleSheet | null {
  const selector = `[data-skin-surface="${CSS.escape(id)}"]`
  const own = mapStyleValues(style, (v) => withAssets(v, url))
  const inner = Object.fromEntries(Object.entries(own).filter(([k]) => !isTopLevel(k)))
  const top = Object.fromEntries(Object.entries(own).filter(([k]) => isTopLevel(k)))
  try {
    const sheet = new CSSStyleSheet()
    sheet.replaceSync(`${selector} {\n${styleCss(inner, '  ')}\n}\n${styleCss(top)}`)
    const kept = [...sheet.cssRules].filter((r, i) => (i === 0 && r instanceof CSSStyleRule && r.selectorText === selector) || r instanceof CSSKeyframesRule)
    if (kept.length !== sheet.cssRules.length) {
      reportFailure('themes', new Error(`A value in the ${id} surface of ${theme.name} closes its block early; only the rules inside it are used.`))
      sheet.replaceSync(kept.map((r) => r.cssText).join('\n'))
    }
    return sheet
  } catch (err) {
    reportFailure('themes', err)
    return null
  }
}

export function surfaceSheets(theme: Theme, url: AssetUrl): CSSStyleSheet[] {
  return Object.entries(theme.surfaces).flatMap(([id, style]) => surfaceSheet(theme, id, style, url) ?? [])
}
