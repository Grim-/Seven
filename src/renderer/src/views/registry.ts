import type { ComponentType } from 'react'
import type { ViewId } from '@shared/types'
import type { WindowApp } from '../store/windows'
import { ChatView } from './ChatView'
import { AgentsView } from './AgentsView'
import { ModelsView } from './ModelsView'
import { ToolsView } from './ToolsView'
import { SettingsView } from './SettingsView'
import {DataView} from './DataView'
import { KindsView } from './KindsView'
import { DashboardsView } from './DashboardsView'
import { PagesView } from './PagesView'
import { ComposerView } from '../components/composer/ComposerView'

export const VIEW_COMPONENTS: Record<ViewId, ComponentType> = {
  chat: ChatView,
  dashboards: DashboardsView,
  pages: PagesView,
  data: DataView,
  composer: ComposerView,
  kinds: KindsView,
  agents: AgentsView,
  tools: ToolsView,
  models: ModelsView,
  settings: SettingsView,
  files : PagesView
}

export const VIEW_APPS: Partial<Record<ViewId, WindowApp>> = { chat: 'chats', data: 'data' }
