import { LayoutDashboard, MessageSquare, Plus } from 'lucide-react'
import type { MenuItem } from '../ui'
import { engine } from '../../lib/ipc'
import { toast } from '../../store/toasts'
import { failed } from '../../lib/notify'
import { useDashboards } from '../../store/dashboards'
import { pinToChatTable, takeBoardIntoChat } from '../chat/tabletopStore'

export function boardMenu(thing: string): MenuItem {
  const boards = useDashboards.getState().list
  const slash = thing.indexOf('/')
  const kind = slash > 0 ? thing.slice(0, slash) : 'page'
  const id = slash > 0 ? thing.slice(slash + 1) : thing
  return {
    label: 'Put on board',
    icon: <LayoutDashboard />,
    children: [
      {
        label: 'Active chat board',
        icon: <MessageSquare />,
        onSelect: () => pinToChatTable(kind, id)
      },
      ...(boards.length > 0 ? [{ label: '', separator: true }] : []),
      ...boards.map((d) => ({
        label: d.name,
        onSelect: () =>
          void engine('widgets.place', { dashboardId: d.id, things: [thing], at: null })
            .then((b) => {
              useDashboards.getState().onChanged(b.id, b)
              toast.success('Put on board', b.name, {
                label: 'Take into chat',
                onSelect: () => takeBoardIntoChat(b.id)
              })
            })
            .catch(failed('Could not add'))
      })),
      ...(boards.length === 0
        ? [
            {
              label: 'New board & place here',
              icon: <Plus />,
              onSelect: () => pinToChatTable(kind, id)
            }
          ]
        : [])
    ]
  }
}
