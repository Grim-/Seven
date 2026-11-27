import type { ComponentType } from 'react'
import { surfaceDefaults } from './surfaceDefaults'
import type { MenuItem } from '../components/ui'
import type { DataSelection } from '../store/data'
import { isPageTypeKind, type LibrarySection } from '@shared/types'
import type { ModuleEntry, ModuleList } from '@shared/moduleList'
import { entryWidget, registerWidgetUi, setDefaultEntryWidgetUi, type WidgetUi } from './widgets'

export interface KindScreenProps {
  kind: string
  id: string | null
  select: (s: DataSelection | null) => void
}

export interface KindMenuContext {
  kind: string
  id: string
  title: string
  select: (s: DataSelection | null) => void
  selected: DataSelection | null
}

export interface EntrySurfaceProps {
  kind: string
  id: string
  part: string
}

export interface EntrySlateProps extends EntrySurfaceProps {
  mode?: 'token' | 'slate'
  onToggleExpand?: () => void
  onRemove?: () => void
  onOpenData?: () => void
}

export interface KindPresent {
  Screen?: ComponentType<KindScreenProps>
  Chat?: ComponentType<EntrySurfaceProps>
  Stage?: ComponentType<EntrySurfaceProps>
  Slate?: ComponentType<EntrySlateProps>
  Widget?: WidgetUi
  Face?: ComponentType<{ id: string }>
  Thumb?: ComponentType<{ id: string; large?: boolean }>
}

export interface KindModuleList {
  label: string
  list: ModuleList<ModuleEntry>
}

export interface KindVariationProps<E> {
  entry: E
  change: (next: E) => void
}

export interface KindVariation<E = Record<string, unknown>> extends ModuleEntry {
  label: string
  has: (entry: E) => boolean
  attach: (entry: E) => E
  remove: (entry: E) => E
  Editor: ComponentType<KindVariationProps<E>>
}

export interface KindUi {
  present?: KindPresent
  moduleLists?: KindModuleList[]
  variations?: ModuleList<KindVariation>
  pictures?: (id: string) => string[]
  whole?: boolean
  open?: (id: string) => void
  opensAt?: (part: string) => boolean
  slateParts?: { part: string; label: string }[]
  add?: (kind: string, select: (s: DataSelection | null) => void) => (() => void) | undefined
  addLabel?: string
  importer?: ComponentType<{ onClose: () => void }>
  importLabel?: string
  home?: ComponentType<KindHomeProps>
  timed?: boolean
  emptyText?: string
  menu?: (ctx: KindMenuContext) => MenuItem[]
  browser?: ComponentType<KindBrowserProps>
  picker?: ComponentType<KindPickerProps>
  showsAs?: string
  railUnder?: { kind: string; count: boolean }
  rail?: { label?: string; icon?: string }
  railGroup?: string
  trail?: ComponentType<{ id: string }>
  back?: (selected: DataSelection) => void
  start?: boolean
  ownView?: string
}

export interface KindBrowserProps {
  section: LibrarySection
  select: (s: DataSelection | null) => void
  onBack?: () => void
}

export interface KindPickerProps {
  section: LibrarySection
  onPick: (kind: string, id: string) => void
}

export const SETUP_GROUP = 'Setup'

export interface KindHomeProps {
  section: LibrarySection
  selected: DataSelection
  select: (s: DataSelection | null) => void
}


const uis = new Map<string, KindUi>()
const NONE: KindUi = {}

const addonKind = isPageTypeKind

export function setDefaultEntrySlate(Slate: ComponentType<EntrySlateProps>): void {
  surfaceDefaults.slate = Slate
  setDefaultEntryWidgetUi(entryWidget(Slate))
}

export function registerKindUi(kind: string, ui: KindUi): void {
  uis.set(kind, ui)
  if (ui.present?.Widget) registerWidgetUi(kind, ui.present.Widget)
  else if (ui.present?.Chat || ui.present?.Slate) registerWidgetUi(kind, entryWidget((ui.present.Chat ?? ui.present.Slate)!))
}

const families = new Map<string, string>()

export function noteKindFamilies(list: { kind: string; family: string | null }[]): void {
  for (const k of list) if (k.family) families.set(k.kind, k.family)
}

export function kindUi(kind: string): KindUi {
  const family = families.get(kind)
  return uis.get(kind) ?? (family ? uis.get(family) : undefined) ?? (addonKind(kind) ? (uis.get('page:addon') ?? NONE) : NONE)
}

export function viewKinds(view: string): string[] {
  return [...uis.entries()].filter(([, ui]) => ui.ownView === view).map(([kind]) => kind)
}

export function ownViewKinds(): string[] {
  return [...uis.entries()].filter(([, ui]) => ui.ownView).map(([kind]) => kind)
}

export function kindModuleLists(): KindModuleList[] {
  return [...uis.values()].flatMap((ui) => ui.moduleLists ?? [])
}

export function presentOf(kind: string): KindPresent {
  const p = kindUi(kind).present ?? {}
  const Slate = p.Slate ?? surfaceDefaults.slate
  const Chat = p.Chat ?? Slate
  const Stage = p.Stage ?? Chat
  return {
    ...p,
    Slate,
    Chat,
    Stage
  }
}

export function ownScreen(kind: string): ComponentType<KindScreenProps> | undefined {
  return uis.get(kind)?.present?.Screen
}

