import { LayoutDashboard } from 'lucide-react'
import type { MenuItem } from '../ui'
import { engine } from '../../lib/ipc'
import { toast } from '../../store/toasts'
import { failed } from '../../lib/notify'
import { useDashboards } from '../../store/dashboards'

export function boardMenu(thing: string): MenuItem {
  const boards = useDashboards.getState().list
  return {
    label: 'Put on board',
    icon: <LayoutDashboard />,
    disabled: boards.length === 0,
    children: boards.map((d) => ({
      label: d.name,
      onSelect: () =>
        void engine('widgets.place', { dashboardId: d.id, things: [thing], at: null })
          .then((b) => toast.success('Put on board', b.name))
          .catch(failed('Could not add'))
    }))
  }
}
