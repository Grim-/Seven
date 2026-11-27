import type { StartColors } from '@shared/startColors'
import { widgetLookKey, type WidgetLook } from '@shared/widgetLook'
import { hasCapability } from '../transport'
import { useApp } from '../../store/app'
import { useThemes } from '../../store/themes'
import { noteFailure } from '../../store/problems'
import { ROLE_FONTS } from '@shared/roles'
import { solid, type Roles } from './roles'

function startColorsOf({ colours }: Roles): StartColors {
  return { ground: solid(colours.bg), ink: solid(colours.ink), dim: solid(colours.dim), accent: solid(colours.accent) }
}

function widgetLookOf(roles: Roles): WidgetLook {
  const fonts = Object.fromEntries(ROLE_FONTS.map((f) => [`font-${f}`, roles.fonts[f]]))
  return { ...roles.colours, ...fonts, 'label-case': roles.label.case, 'label-tracking': roles.label.tracking, 'label-variant': roles.label.variant }
}

export function rememberLook(roles: Roles): void {
  if (!hasCapability('startColors') || useThemes.getState().preview) return
  const app = useApp.getState()
  if (!app.settings) return
  const startColors = startColorsOf(roles)
  const widgetLook = widgetLookOf(roles)
  const same = JSON.stringify(app.settings.startColors) === JSON.stringify(startColors) && widgetLookKey(app.settings.widgetLook) === widgetLookKey(widgetLook)
  if (same) return
  void app.updateSettings({ startColors, widgetLook }).catch(noteFailure('themes', 'Could not remember the look'))
}
