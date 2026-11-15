import { useState, type MouseEvent, type ReactNode } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { KindVariation } from '../../registries/kinds'
import { Button } from './Button'
import { openMenu, type MenuItem } from './ContextMenu'
import { ShellTabs } from './ShellTabs'

const OWN = ''

export function VariationTabs<E>({ entry, change, variations, ownLabel, own }: { entry: E; change: (next: E) => void; variations: KindVariation<E>[]; ownLabel: string; own: ReactNode }) {
  const had = variations.filter((v) => v.has(entry))
  const free = variations.filter((v) => !v.has(entry))
  const [tab, setTab] = useState(had[0]?.id ?? OWN)
  const current = had.find((v) => v.id === tab) ?? null
  const adds: MenuItem[] = free.map((v) => ({
    label: v.label,
    onSelect: () => {
      change(v.attach(entry))
      setTab(v.id)
    }
  }))
  const menu = (e: MouseEvent, id: string) => {
    const v = had.find((x) => x.id === id)
    openMenu(e, v ? v.label : ownLabel, [
      ...(v
        ? [
            {
              label: `Remove ${v.label}`,
              icon: <Trash2 />,
              danger: true,
              onSelect: () => {
                change(v.remove(entry))
                setTab(OWN)
              }
            }
          ]
        : []),
      ...(adds.length ? [{ label: 'Add', icon: <Plus />, children: adds }] : [])
    ])
  }
  const Editor = current?.Editor
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <ShellTabs value={current ? current.id : OWN} options={[{ value: OWN, label: ownLabel }, ...had.map((v) => ({ value: v.id, label: v.label }))]} onChange={setTab} onMenu={menu}>
        {adds.length > 0 && (
          <Button size="sm" variant="ghost" icon={<Plus />} onClick={(e) => openMenu(e, 'Add', adds)}>
            Add
          </Button>
        )}
      </ShellTabs>
      {Editor ? <Editor entry={entry} change={change} /> : own}
    </div>
  )
}
