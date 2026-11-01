import { Bot, Cpu, Database, LayoutDashboard, MessageSquare, NotebookPen, Settings as SettingsIcon, Wrench } from 'lucide-react'
import type { ViewId } from '@shared/types'

export const VIEW_TABS: { id: ViewId; label: string; icon: React.ReactNode }[] = [
  { id: 'chat', label: 'Chat', icon: <MessageSquare /> },
  { id: 'dashboards', label: 'Dashboards', icon: <LayoutDashboard /> },
  { id: 'data', label: 'Data', icon: <Database /> },
  { id: 'files', label: 'Files', icon: <Database /> },
  { id: 'composer', label: 'Composer', icon: <NotebookPen /> },
  { id: 'agents', label: 'Agents', icon: <Bot /> },
  { id: 'tools', label: 'Tools', icon: <Wrench /> },
  { id: 'models', label: 'Models', icon: <Cpu /> }
]

export const SETTINGS_TAB: { id: ViewId; label: string; icon: React.ReactNode } = { id: 'settings', label: 'Settings', icon: <SettingsIcon /> }
