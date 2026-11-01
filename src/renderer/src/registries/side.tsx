import type { ReactNode } from 'react'
import { BarChart3, BookOpen, Box, Code2, FileText, FolderOpen, Globe, Image, Inbox, List, Sparkles, Terminal } from 'lucide-react'
import type { ModuleInfo } from '@shared/types'

export interface SideTabContext {
  sessionId: string | null
  agentModules: string[]
  hasItems: (tab: string) => boolean
}

export interface SideTabDef {
  id: string
  label: string
  icon: ReactNode
  order: number
  visible?: (ctx: SideTabContext) => boolean
  render: (ctx: SideTabContext) => ReactNode
}

const ICONS: Record<string, ReactNode> = {
  terminal: <Terminal className="h-3.5 w-3.5" />,
  image: <Image className="h-3.5 w-3.5" />,
  chart: <BarChart3 className="h-3.5 w-3.5" />,
  file: <FileText className="h-3.5 w-3.5" />,
  folder: <FolderOpen className="h-3.5 w-3.5" />,
  book: <BookOpen className="h-3.5 w-3.5" />,
  globe: <Globe className="h-3.5 w-3.5" />,
  code: <Code2 className="h-3.5 w-3.5" />,
  list: <List className="h-3.5 w-3.5" />,
  sparkles: <Sparkles className="h-3.5 w-3.5" />,
  inbox: <Inbox className="h-3.5 w-3.5" />
}

export function sideIcon(name: string): ReactNode {
  return ICONS[name] ?? <Box className="h-3.5 w-3.5" />
}

const registered = new Map<string, SideTabDef>()

export function registerSideTab(def: SideTabDef): void {
  registered.set(def.id, def)
}

export function sideTabs(
  modules: ModuleInfo[],
  ctx: SideTabContext,
  itemsTab: (moduleId: string) => SideTabDef['render'],
  pageTab: (pageType: string) => SideTabDef['render']
): SideTabDef[] {
  const items: SideTabDef[] = modules
    .filter((m) => m.panel && !registered.has(m.id))
    .map((m, i) => ({
      id: m.id,
      label: m.panel?.label ?? m.name,
      icon: sideIcon(m.panel?.icon ?? ''),
      order: 100 + i,
      visible: (c) => c.agentModules.includes(m.id) || c.hasItems(m.id),
      render: itemsTab(m.id)
    }))
  const pages: SideTabDef[] = modules
    .filter((m) => m.state === 'on')
    .flatMap((m) => m.pages.filter((p) => p.panel).map((p) => ({ module: m, page: p })))
    .map(({ module: m, page: p }, i) => ({
      id: `${m.id}:${p.type}`,
      label: p.label,
      icon: sideIcon(p.icon),
      order: 50 + i,
      render: pageTab(`${m.id}:${p.type}`)
    }))
  return [...registered.values(), ...items, ...pages].filter((t) => !t.visible || t.visible(ctx)).sort((a, b) => a.order - b.order)
}
