import { createElement, type ComponentType, type ReactNode } from 'react'
import { Blocks, Bot, Cpu, Database, FolderOpen, Gamepad2, Gauge, LayoutDashboard, MessageSquare, NotebookPen, Server, Settings, Wrench } from 'lucide-react'
import type { ViewId } from '@shared/types'
import type { WindowApp } from '../store/windows'
import { ChatView } from './ChatView'
import { PlayView } from './PlayView'
import { AgentsView } from './AgentsView'
import { ModelsView } from './ModelsView'
import { ToolsView } from './ToolsView'
import { SettingsView } from './SettingsView'
import { DataView } from './DataView'
import { KindsView } from './KindsView'
import { DashboardsView } from './DashboardsView'
import { FilesView } from './FilesView'
import { ComposerView } from '../components/composer/ComposerView'
import { SpeedView } from './SpeedView'
import { ServerView } from './ServerView'

export interface MainView {
  id: ViewId
  label: string
  icon: ReactNode
  Component: ComponentType
  nav: 'tabs' | 'settings' | null
  app?: WindowApp
  menu?: { label: string; icon: ReactNode; view: ViewId }[]
}

const icon = (Icon: ComponentType) => createElement(Icon)

export const MAIN_VIEWS: MainView[] = [
  { id: 'chat', label: 'Chat', icon: icon(MessageSquare), Component: ChatView, nav: 'tabs', app: 'chats' },
  { id: 'play', label: 'Play', icon: icon(Gamepad2), Component: PlayView, nav: 'tabs' },
  { id: 'dashboards', label: 'Dashboards', icon: icon(LayoutDashboard), Component: DashboardsView, nav: 'tabs' },
  { id: 'data', label: 'Data', icon: icon(Database), Component: DataView, nav: 'tabs', app: 'data' },
  { id: 'pages', label: 'Files', icon: icon(FolderOpen), Component: FilesView, nav: 'tabs' },
  { id: 'composer', label: 'Composer', icon: icon(NotebookPen), Component: ComposerView, nav: 'tabs' },
  { id: 'agents', label: 'Agents', icon: icon(Bot), Component: AgentsView, nav: 'tabs' },
  { id: 'tools', label: 'Tools', icon: icon(Wrench), Component: ToolsView, nav: 'tabs' },
  { id: 'models', label: 'Models', icon: icon(Cpu), Component: ModelsView, nav: 'tabs', menu: [{ label: 'Speed ranking', icon: icon(Gauge), view: 'speed' }, { label: 'llama-server', icon: icon(Server), view: 'server' }] },
  { id: 'speed', label: 'Model speed', icon: icon(Gauge), Component: SpeedView, nav: null },
  { id: 'server', label: 'llama-server', icon: icon(Server), Component: ServerView, nav: null },
  { id: 'kinds', label: 'Kinds', icon: icon(Blocks), Component: KindsView, nav: null },
  { id: 'settings', label: 'Settings', icon: icon(Settings), Component: SettingsView, nav: 'settings' }
]

export function viewOf(id: ViewId): MainView {
  return MAIN_VIEWS.find((v) => v.id === id) ?? MAIN_VIEWS[0]
}

export function viewsIn(nav: MainView['nav']): MainView[] {
  return MAIN_VIEWS.filter((v) => v.nav === nav)
}
