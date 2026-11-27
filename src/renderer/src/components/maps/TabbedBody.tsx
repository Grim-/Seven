import { ShellTabs } from '../ui'
import { useViewPlace } from '../../lib/viewPlace'
import type { InspectorTab } from './InspectorShell'

export function TabbedBody({ place, tabs }: { place: string; tabs: InspectorTab[] }) {
  const [picked, setPicked] = useViewPlace<string>(`inspector.${place}`, tabs[0]?.id ?? '')
  const tab = tabs.find((t) => t.id === picked) ?? tabs[0]
  return (
    <>
      <ShellTabs value={tab?.id ?? ''} options={tabs.map(({ id, label, icon, count }) => ({ value: id, label, icon, count }))} onChange={setPicked} className="px-2" />
      <div className="min-h-0 flex-1 overflow-y-auto p-3">{tab?.body}</div>
    </>
  )
}
