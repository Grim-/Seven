import type { ModuleActionDef, ModuleKind, ModuleSettingDef, PageTypeInfo, PanelTabInfo, ToolPermission } from '@shared/types'
import { API_VERSION } from './sdk'

export interface McpConfig {
  transport: 'stdio' | 'http' | 'sse'
  command: string | null
  args: string[]
  env: Record<string, string>
  cwd: string | null
  url: string | null
  headers: Record<string, string>
}

export interface Manifest {
  id: string
  name: string
  description: string
  version: string
  apiVersion: number
  entry: string
  kind: ModuleKind
  needsWorkspace: boolean
  always: boolean
  toolless: boolean
  permission: ToolPermission
  toolPermissions: Record<string, ToolPermission>
  settings: ModuleSettingDef[]
  actions: ModuleActionDef[]
  panel: PanelTabInfo | null
  pages: PageTypeInfo[]
  presentations: TemplateSpec[]
  dependencies: string[]
  mcp: McpConfig | null
}

export type TemplateFieldType = 'string' | 'number' | 'boolean' | 'list'

export interface TemplateField {
  type: TemplateFieldType
  description: string
  optional: boolean
}

export interface TemplateSpec {
  type: string
  description: string
  template: string
  fields: Record<string, TemplateField>
}

const FIELD_KINDS: TemplateFieldType[] = ['string', 'number', 'boolean', 'list']

function presentationsOf(value: unknown): TemplateSpec[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return []
    const r = raw as Record<string, unknown>
    const type = typeof r.type === 'string' ? r.type.trim().toLowerCase() : ''
    const template = typeof r.template === 'string' ? r.template.trim() : ''
    if (!/^[a-z][a-z0-9_]{0,30}$/.test(type)) throw new Error(`Presentation type "${type}" must be lower-case letters, numbers and _`)
    if (!/^[\w.-]+\.html?$/i.test(template)) throw new Error(`Presentation "${type}" needs a template file name ending in .html, in the module folder`)
    const fields: Record<string, TemplateField> = {}
    for (const [name, def] of Object.entries((r.fields && typeof r.fields === 'object' ? r.fields : {}) as Record<string, unknown>)) {
      if (!/^[A-Za-z][\w]{0,30}$/.test(name)) throw new Error(`Field "${name}" in presentation "${type}" must be letters, numbers and _`)
      const d = (typeof def === 'string' ? { description: def } : def && typeof def === 'object' ? def : {}) as Record<string, unknown>
      fields[name] = {
        type: FIELD_KINDS.includes(d.type as TemplateFieldType) ? (d.type as TemplateFieldType) : 'string',
        description: typeof d.description === 'string' ? d.description : '',
        optional: d.optional === true
      }
    }
    if (!Object.keys(fields).length) throw new Error(`Presentation "${type}" needs at least one field`)
    return [{ type, description: typeof r.description === 'string' ? r.description.trim() : '', template, fields }]
  })
}

function panelOf(value: unknown, name: string): PanelTabInfo | null {
  if (!value) return null
  const raw = (typeof value === 'object' ? value : {}) as Record<string, unknown>
  return {
    label: typeof raw.label === 'string' && raw.label.trim() ? raw.label.trim().slice(0, 24) : name,
    icon: typeof raw.icon === 'string' ? raw.icon.trim() : ''
  }
}

const VIEW_FILE = /^[\w.-]+\.html?$/i
const PAGE_TYPE = /^[a-z][a-z0-9_]{0,30}$/

function pagesOf(value: unknown, legacyView: unknown, panel: unknown, id: string, name: string): PageTypeInfo[] {
  const out: PageTypeInfo[] = []
  const label = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 24) : fallback)
  for (const raw of Array.isArray(value) ? value : []) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    const type = typeof r.type === 'string' ? r.type.trim().toLowerCase() : ''
    if (!PAGE_TYPE.test(type)) throw new Error(`Page type "${type}" must be lower-case letters, numbers and _`)
    const parts: Record<string, string> = {}
    if (r.parts && typeof r.parts === 'object' && !Array.isArray(r.parts))
      for (const [name, file] of Object.entries(r.parts as Record<string, unknown>)) {
        if (!PAGE_TYPE.test(name)) throw new Error(`Part "${name}" of "${type}" must be lower-case letters, numbers and _`)
        if (typeof file !== 'string' || !VIEW_FILE.test(file.trim())) throw new Error(`Part "${name}" of "${type}" needs an .html file in the module folder`)
        parts[name] = file.trim()
      }
    const rawView = typeof r.view === 'string' ? r.view.trim() : ''
    const rawWidget = typeof r.widget === 'string' ? r.widget.trim() : ''
    if (!Object.keys(parts).length) {
      if (!VIEW_FILE.test(rawView)) throw new Error(`"${type}" needs parts (or a view file ending in .html), in the module folder`)
      parts.view = rawView
      if (VIEW_FILE.test(rawWidget)) parts.widget = rawWidget
    }
    const view = VIEW_FILE.test(rawView) ? rawView : Object.values(parts)[0]
    const widget = parts[rawWidget] ?? (VIEW_FILE.test(rawWidget) ? rawWidget : (parts.widget ?? null))
    const single = r.single === true
    const named = label(r.label, type)
    const group = typeof r.group === 'string' && r.group.trim() ? r.group.trim().slice(0, 30) : null
    out.push({ group, rollable: r.rollable === true, actions: (Array.isArray(r.actions) ? r.actions : []).filter((a): a is string => typeof a === 'string' && Boolean(a.trim())).map((a) => a.trim()), type, label: named, plural: typeof r.plural === 'string' && r.plural.trim() ? r.plural.trim().slice(0, 30) : named.endsWith('s') ? named : `${named}s`, description: typeof r.description === 'string' ? r.description.trim().slice(0, 200) : '', icon: typeof r.icon === 'string' ? r.icon.trim() : '', view, widget, parts, single, panel: single && r.panel === true })
  }
  if (out.length) return out
  const legacy = (typeof legacyView === 'string' ? { file: legacyView } : legacyView && typeof legacyView === 'object' ? legacyView : null) as Record<string, unknown> | null
  const tab = panel && typeof panel === 'object' ? (panel as Record<string, unknown>) : null
  const file = typeof legacy?.file === 'string' ? legacy.file.trim() : typeof tab?.view === 'string' ? tab.view.trim() : ''
  if (!VIEW_FILE.test(file)) return []
  const places = legacy ? (Array.isArray(legacy.in) ? legacy.in : ['data']) : ['panel']
  const src = legacy ?? tab ?? {}
  return [{ type: id.replace(/-/g, '_'), label: label(src.label, name), plural: label(src.label, name), description: '', icon: typeof src.icon === 'string' ? src.icon.trim() : '', view: file, widget: null, parts: { view: file }, single: true, panel: places.includes('panel'), group: null, rollable: false, actions: [] }]
}

export const PERMISSIONS: ToolPermission[] = ['none', 'ask', 'always', 'custom']

export const ID_PATTERN = /^[a-z][a-z0-9-]{0,47}$/

function strings(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([, v]) => typeof v === 'string' || typeof v === 'number').map(([k, v]) => [k, String(v)]))
}

function actionsOf(value: unknown): ModuleActionDef[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((raw) => {
    const a = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
    if (typeof a.name !== 'string' || !/^[a-z][a-z0-9_]{0,40}$/.test(a.name)) return []
    return [{ name: a.name, label: typeof a.label === 'string' && a.label.trim() ? a.label.trim().slice(0, 40) : a.name, ...(typeof a.description === 'string' ? { description: a.description.slice(0, 300) } : {}) }]
  })
}

function settingsOf(value: unknown): ModuleSettingDef[] {
  if (!Array.isArray(value)) return []
  const out: ModuleSettingDef[] = []
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue
    const s = raw as Record<string, unknown>
    if (typeof s.name !== 'string' || !/^[A-Za-z][\w-]{0,47}$/.test(s.name)) throw new Error(`Setting name "${String(s.name)}" must be letters, numbers, _ or -`)
    const type = s.type === 'number' || s.type === 'boolean' || s.type === 'folder' ? s.type : 'string'
    const def = s.default
    out.push({
      name: s.name,
      type,
      label: typeof s.label === 'string' && s.label.trim() ? s.label : s.name,
      ...(typeof s.description === 'string' ? { description: s.description } : {}),
      ...(typeof def === (type === 'folder' ? 'string' : type) ? { default: def as string | number | boolean } : {}),
      ...(s.secret === true ? { secret: true } : {})
    })
  }
  return out
}

function mcpOf(raw: Record<string, unknown>): McpConfig {
  const transport = raw.transport === 'http' || raw.transport === 'sse' ? raw.transport : raw.url && !raw.command ? 'http' : 'stdio'
  const command = typeof raw.command === 'string' && raw.command.trim() ? raw.command.trim() : null
  const url = typeof raw.url === 'string' && raw.url.trim() ? raw.url.trim() : null
  if (transport === 'stdio' && !command) throw new Error('An MCP module needs "command" (or "url" for a server reached over HTTP)')
  if (transport !== 'stdio' && !url) throw new Error(`An MCP module using ${transport} needs "url"`)
  return {
    transport,
    command,
    args: Array.isArray(raw.args) ? raw.args.map(String) : [],
    env: strings(raw.env),
    cwd: typeof raw.cwd === 'string' && raw.cwd.trim() ? raw.cwd.trim() : null,
    url,
    headers: strings(raw.headers)
  }
}

export function parseManifest(input: unknown, folderName: string, builtin: boolean): Manifest {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('module.json must be a JSON object')
  const raw = input as Record<string, unknown>
  const id = typeof raw.id === 'string' ? raw.id.trim() : folderName
  if (!ID_PATTERN.test(id)) throw new Error(`Module id "${id}" must be lower-case letters, numbers and -, starting with a letter, e.g. "my-tools". Set "id" in module.json (it defaults to the folder name).`)
  const kind: ModuleKind = raw.type === 'mcp' ? 'mcp' : 'tools'
  const apiVersion = typeof raw.apiVersion === 'number' ? raw.apiVersion : API_VERSION
  if (kind === 'tools' && apiVersion !== API_VERSION) throw new Error(`Module "${id}" was written for apiVersion ${apiVersion}; Seven uses ${API_VERSION}. Update the module for apiVersion ${API_VERSION} and set "apiVersion": ${API_VERSION} in its module.json, or get a newer version of it.`)
  const fallback: ToolPermission = builtin ? 'custom' : 'ask'
  const permission = PERMISSIONS.includes(raw.permission as ToolPermission) ? (raw.permission as ToolPermission) : fallback
  const toolPermissions: Record<string, ToolPermission> = {}
  if (raw.toolPermissions && typeof raw.toolPermissions === 'object') {
    for (const [name, p] of Object.entries(raw.toolPermissions as Record<string, unknown>)) if (PERMISSIONS.includes(p as ToolPermission)) toolPermissions[name] = p as ToolPermission
  }
  return {
    id,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : id,
    description: typeof raw.description === 'string' ? raw.description.trim() : '',
    version: typeof raw.version === 'string' ? raw.version : '0.0.0',
    apiVersion,
    entry: typeof raw.entry === 'string' && raw.entry.trim() ? raw.entry.trim() : 'index.js',
    kind,
    needsWorkspace: raw.needsWorkspace === true,
    always: raw.always === true,
    toolless: raw.tools === false,
    permission,
    toolPermissions,
    settings: settingsOf(raw.settings),
    actions: actionsOf(raw.actions),
    presentations: presentationsOf(raw.presentations),
    dependencies: Array.isArray(raw.dependencies) ? [...new Set(raw.dependencies.filter((d): d is string => typeof d === 'string' && ID_PATTERN.test(d) && d !== id))] : [],
    panel: panelOf(raw.panel, typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : id),
    pages: pagesOf(raw.kinds ?? raw.pages, raw.view, raw.panel, id, typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : id),
    mcp: kind === 'mcp' ? mcpOf((raw.mcp && typeof raw.mcp === 'object' ? raw.mcp : raw) as Record<string, unknown>) : null
  }
}

export function fillSettings(text: string, values: Record<string, unknown>): string {
  return text.replace(/\$\{(?:settings\.)?([A-Za-z][\w-]*)\}/g, (m, name: string) => (name in values && values[name] !== undefined && values[name] !== null ? String(values[name]) : m))
}
