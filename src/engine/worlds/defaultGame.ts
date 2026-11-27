import { ensureCharacterDefaults } from '@shared/game/components'
import { spawn, type EntityRecord, type Template } from '@shared/game/core'
import { CHARACTER_TEMPLATES } from '@shared/game/templateKinds'
import { effectCatalog } from '../effects/catalog'

export function defaultCharacterGameRecord(name: string, uid?: string): EntityRecord | null {
  const cat = effectCatalog()
  if (!cat) return null
  const baseTemplate = cat.entity(CHARACTER_TEMPLATES, 'adventurer')
  const tpl: Template = baseTemplate
    ? { ...baseTemplate, name: name.trim() || baseTemplate.name }
    : { ref: { kind: CHARACTER_TEMPLATES, id: 'adventurer' }, name: name.trim() || 'Character', components: [] }
  const entity = spawn(tpl, cat)
  ensureCharacterDefaults(entity)
  const record = entity.toRecord()
  entity.stop()
  return uid ? { ...record, uid } : record
}
