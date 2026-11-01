import type { DataSelection } from '../store/data'
import { LockedState, useLocked } from '../components/vault/Vault'
import { DataWindow } from './data/DataWindow'
import { PanelBrowser } from './data/PanelBrowser'

export function DataView() {
  const locked = useLocked()
  if (locked) return <div className="h-full p-3"><LockedState what="Your data" /></div>
  return <DataWindow />
}

export function DataBrowser({ selected, select }: { mode: 'panel'; selected: DataSelection | null; select: (s: DataSelection | null) => void }) {
  return <PanelBrowser selected={selected} select={select} />
}
