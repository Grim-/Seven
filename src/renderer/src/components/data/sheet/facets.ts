import type { ComponentType } from 'react'
import type { CharacterSheet } from '@shared/types'
import { moduleList, type ModuleEntry } from '@shared/moduleList'

export type SheetDraft = Pick<CharacterSheet, 'title' | 'fields' | 'values' | 'dnd' | 'story' | 'mind' | 'relationships'>

export interface FacetProps {
  sheet: CharacterSheet
  draft: SheetDraft
  change: (next: SheetDraft) => void
  open: (facet: string) => void
  campaign: string | null
}

export interface SheetFacet extends ModuleEntry {
  label: (draft: SheetDraft) => string
  system?: boolean
  has?: (sheet: CharacterSheet, draft: SheetDraft) => boolean
  attach?: (draft: SheetDraft) => SheetDraft
  opensFirst?: (draft: SheetDraft) => boolean
  Tab: ComponentType<FacetProps>
}

export const sheetFacets = moduleList<SheetFacet>()
