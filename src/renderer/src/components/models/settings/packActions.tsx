import { ArrowDown, ArrowUp, Copy, FileUp, FolderOpen, Power, PowerOff, Trash2 } from 'lucide-react'
import type { PackView } from '@shared/types'
import { confirmDelete, pickFile, type MenuItem } from '../../ui'
import { engine, main } from '../../../lib/ipc'
import { copyText, failed } from '../../../lib/notify'
import { toast } from '../../../store/toasts'

type SetOn = (on: string[]) => void

export function packToggle(pack: PackView, on: string[], setOn: SetOn): MenuItem {
  return pack.on
    ? { label: 'Turn off', icon: <PowerOff />, onSelect: () => setOn(on.filter((id) => id !== pack.id)) }
    : { label: 'Turn on', icon: <Power />, disabled: Boolean(pack.invalid), hint: pack.invalid ?? undefined, onSelect: () => setOn([...on, pack.id]) }
}

export function packMoves(pack: PackView, on: string[], setOn: SetOn): MenuItem[] {
  const at = on.indexOf(pack.id)
  const move = (to: number) => {
    const next = on.filter((id) => id !== pack.id)
    next.splice(to, 0, pack.id)
    setOn(next)
  }
  const order: MenuItem[] = pack.on
    ? [
        { label: 'Earlier', icon: <ArrowUp />, disabled: at <= 0, onSelect: () => move(at - 1) },
        { label: 'Later', icon: <ArrowDown />, disabled: at === on.length - 1, onSelect: () => move(at + 1) }
      ]
    : []
  return [...order, { label: 'Copy source link', icon: <Copy />, disabled: !pack.source, onSelect: () => copyText(pack.source) }]
}

export function packRemove(pack: PackView): MenuItem {
  return {
    label: 'Delete',
    icon: <Trash2 />,
    danger: true,
    disabled: pack.shipped,
    hint: pack.shipped ? 'Seven ships this pack. Turn it off instead.' : undefined,
    onSelect: () => confirmDelete(`Delete ${pack.title}?`, `This deletes ${pack.file}.`, () => engine('packs.remove', { file: pack.file }))
  }
}

export function packActions(pack: PackView, on: string[], setOn: SetOn): MenuItem[] {
  return [packToggle(pack, on, setOn), ...packMoves(pack, on, setOn), packRemove(pack)]
}

export function packFolderActions(folder: string): MenuItem[] {
  return [
    {
      label: 'Import pack',
      icon: <FileUp />,
      hint: 'Copies a pack file into your packs folder.',
      onSelect: () =>
        pickFile([{ name: 'Seven pack', extensions: ['json'] }], (file) =>
          void engine('packs.import', { file })
            .then(({ title }) => toast.success('Pack added', title))
            .catch(failed('Could not import that pack'))
        )
    },
    { label: 'Your packs folder', icon: <FolderOpen />, onSelect: () => void main('folder.open', { path: folder }).catch(failed('Could not open the packs folder')) }
  ]
}
