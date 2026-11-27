import { createElement, useMemo, type ComponentType, type ReactNode } from 'react'
import { Blocks, BookOpen, Bot, Clapperboard, Cpu, Database, Download, FolderOpen, Gamepad2, Gauge, Image as ImageIcon, LayoutDashboard, MessageSquare, NotebookPen, Server, Settings, Wrench } from 'lucide-react'
import type { ViewId } from '@shared/types'
import type { WindowApp } from '../store/windows'
import { useApp } from '../store/app'
import { useTools } from '../store/tools'
import { setChatViewMode } from '../lib/chatViewMode'
import { openHelperInstaller, openInstalledModels, openModelDownloads, openServerView } from '../lib/openServer'
import { ChatView } from './ChatView'
import { PlayView } from './PlayView'
import { AgentsView } from './AgentsView'
import { ModelsView } from './ModelsView'
import { ToolsView } from './ToolsView'
import { SettingsView } from './SettingsView'
import { GuidesView } from './GuidesView'
import { DataView } from './DataView'
import { KindsView } from './KindsView'
import { DashboardsView } from './DashboardsView'
import { FilesView } from './FilesView'
import { ImageView } from './ImageView'
import { ComposerView } from '../components/composer/ComposerView'
import { SpeedView } from './SpeedView'
import { ServerView } from './ServerView'

export interface MainViewMenuItem {
  label: string
  icon: ReactNode
  view?: ViewId
  onSelect?: () => void
}

export interface MainView {
  id: ViewId
  label: string
  icon: ReactNode
  Component: ComponentType
  nav: 'tabs' | 'settings' | null
  module?: string
  app?: WindowApp
  menu?: MainViewMenuItem[]
}

const icon = (Icon: ComponentType) => createElement(Icon)

export const MAIN_VIEWS: MainView[] = [
  {
    id: 'chat',
    label: 'Chat',
    icon: icon(MessageSquare),
    Component: ChatView,
    nav: 'tabs',
    app: 'chats',
    menu: [
      {
        label: 'Default',
        icon: icon(MessageSquare),
        onSelect: () => {
          useApp.getState().setView('chat')
          setChatViewMode('default')
        }
      },
      {
        label: 'Tabletop',
        icon: icon(LayoutDashboard),
        onSelect: () => {
          useApp.getState().setView('chat')
          setChatViewMode('tabletop')
        }
      },
      {
        label: 'Cinema',
        icon: icon(Clapperboard),
        onSelect: () => {
          useApp.getState().setView('chat')
          setChatViewMode('cinema')
        }
      }
    ]
  },
  { id: 'play', label: 'Play', icon: icon(Gamepad2), Component: PlayView, nav: 'tabs', module: 'play' },
  { id: 'dashboards', label: 'Dashboards', icon: icon(LayoutDashboard), Component: DashboardsView, nav: 'tabs' },
  { id: 'data', label: 'Data', icon: icon(Database), Component: DataView, nav: 'tabs', app: 'data' },
  { id: 'pages', label: 'Files', icon: icon(FolderOpen), Component: FilesView, nav: 'tabs' },
  { id: 'composer', label: 'Composer', icon: icon(NotebookPen), Component: ComposerView, nav: 'tabs' },
  { id: 'image', label: 'Image', icon: icon(ImageIcon), Component: ImageView, nav: 'tabs', module: 'image' },
  { id: 'agents', label: 'Agents', icon: icon(Bot), Component: AgentsView, nav: 'tabs' },
  { id: 'tools', label: 'Tools', icon: icon(Wrench), Component: ToolsView, nav: 'tabs' },
  {
    id: 'models',
    label: 'Models',
    icon: icon(Cpu),
    Component: ModelsView,
    nav: 'tabs',
    menu: [
      { label: 'Installed models', icon: icon(Cpu), onSelect: () => openInstalledModels() },
      { label: 'Download models', icon: icon(Download), onSelect: () => openModelDownloads() },
      { label: 'Helper installers', icon: icon(Download), onSelect: () => openHelperInstaller() },
      { label: 'llama-server', icon: icon(Server), onSelect: () => openServerView('llama-server') },
      { label: 'sd-server (Image server)', icon: icon(Server), onSelect: () => openServerView('sd-server') },
      { label: 'Speed ranking', icon: icon(Gauge), view: 'speed' }
    ]
  },
  { id: 'speed', label: 'Model speed', icon: icon(Gauge), Component: SpeedView, nav: null },
  { id: 'server', label: 'Servers', icon: icon(Server), Component: ServerView, nav: null },
  { id: 'kinds', label: 'Kinds', icon: icon(Blocks), Component: KindsView, nav: null },
  { id: 'guides', label: 'Guides', icon: icon(BookOpen), Component: GuidesView, nav: 'settings' },
  { id: 'settings', label: 'Settings', icon: icon(Settings), Component: SettingsView, nav: 'settings' }
]

export function viewOf(id: ViewId): MainView {
  return MAIN_VIEWS.find((v) => v.id === id) ?? MAIN_VIEWS[0]
}

export function viewsIn(nav: MainView['nav']): MainView[] {
  return MAIN_VIEWS.filter((v) => v.nav === nav && !v.module)
}

export function useViewsIn(nav: MainView['nav']): MainView[] {
  const list = useTools((s) => s.list)
  return useMemo(
    () => MAIN_VIEWS.filter((v) => v.nav === nav && (!v.module || list.some((m) => m.id === v.module && m.state === 'on'))),
    [nav, list]
  )
}
