import type { MouseEvent } from 'react'
import { Check, ChevronDown, Copy, Import, Pencil, Plus, Trash2 } from 'lucide-react'
import { askText, confirmDelete, openMenu, type MenuItem } from '../ui'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { useWorldSaves } from './useSaves'

export function SavePicker({ world }: { world: string }) {
  const list = useWorldSaves(world)
  const current = list?.saves.find((s) => s.id === list.current) ?? null
  const open = (e: MouseEvent) => {
    if (!list) return
    const items: MenuItem[] = [
      ...list.saves.map((s) => ({ label: s.name, icon: s.id === list.current ? <Check /> : undefined, onSelect: () => void engine('saves.select', { world, id: s.id }).catch(failed('Could not switch saves')) })),
      { label: 'New save', icon: <Plus />, onSelect: () => askText('New save', 'Name', '', (name) => void engine('saves.create', { world, name, copy: false }).catch(failed('Could not make the save'))) },
      ...(current
        ? [
            { label: 'Copy this save', icon: <Copy />, onSelect: () => askText('Copy this save', 'Name', `${current.name} copy`, (name) => void engine('saves.create', { world, name, copy: true }).catch(failed('Could not copy the save'))) },
            { label: 'Rename this save', icon: <Pencil />, onSelect: () => askText('Rename the save', 'Name', current.name, (name) => void engine('saves.rename', { id: current.id, name }).catch(failed('Could not rename the save'))) },
            { label: 'Bring in the old play state', icon: <Import />, onSelect: () => void engine('saves.adopt', { world }).catch(failed('Could not bring it in')) },
            { label: 'Delete this save', icon: <Trash2 />, danger: true, onSelect: () => confirmDelete(`Delete ${current.name}?`, 'Everything that happened in it is gone for good. Its characters leave first, taking their state onto their sheets.', () => engine('saves.remove', { id: current.id })) }
          ]
        : [])
    ]
    openMenu(e, 'Saves', items)
  }
  return (
    <button type="button" onClick={open} className="flex h-8 items-center gap-2 border border-line/50 tone-well-60 px-2.5 text-[12.5px] text-ink hover:border-line-hover">
      <span className="font-label text-[10.5px] caps-12 text-dim">Save</span>
      {current?.name ?? '…'}
      {current && current.characters.length > 0 && <span className="font-ui text-[10.5px] text-dim">{current.characters.length} in it</span>}
      <ChevronDown className="h-3.5 w-3.5 text-dim" />
    </button>
  )
}
