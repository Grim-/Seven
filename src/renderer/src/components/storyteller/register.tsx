import { kindUi, registerKindUi } from '../../registries/kinds'
import { PoiScreen } from './PoiScreen'
import { TemplateScreen } from './TemplateScreen'

export function registerStoryteller(): void {
  const addon = kindUi('page:addon')
  registerKindUi('storyteller.template', { ...addon, present: { ...addon.present, Screen: TemplateScreen } })
  registerKindUi('storyteller.poi', { ...addon, present: { ...addon.present, Screen: PoiScreen } })
}
