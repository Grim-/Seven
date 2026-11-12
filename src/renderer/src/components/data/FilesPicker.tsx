import { useMemo } from 'react'
import { FOLDER_TYPE, showName } from '@shared/ids'
import { pageKindOf } from '@shared/types'
import { ancestorsOf, useData } from '../../store/data'
import { useViewPlace } from '../../lib/viewPlace'
import type { KindPickerProps } from '../../registries/kinds'
import { PageExplorer } from './PageExplorer'
import { FolderPath } from './FolderPath'

export function FilesPicker({ onPick }: KindPickerProps) {
  const pages = useData((s) => s.pages)
  const byId = useMemo(() => new Map(pages.map((p) => [p.id, p])), [pages])
  const [saved, setFolder] = useViewPlace<string | null>('pick.folder', null)
  const folder = saved && byId.has(saved) ? saved : null
  const currentFolder = folder ? (byId.get(folder) ?? null) : null
  const trail = folder ? ancestorsOf(folder, byId).map((p) => ({ id: p.id, title: showName(p.title) })) : []
  const up = folder ? (currentFolder?.parent ?? null) : undefined
  const parent = up && byId.has(up) ? up : null

  return (
    <PageExplorer
      folder={folder}
      header={<FolderPath trail={trail} current={folder ? showName(currentFolder?.title ?? '') : ''} up={folder ? parent : undefined} onPick={setFolder} />}
      onOpen={(id) => {
        const p = id ? byId.get(id) : undefined
        if (!p || p.type === FOLDER_TYPE) return setFolder(id)
        onPick(pageKindOf(p.type), p.id)
      }}
      onOpenFile={(id) => onPick('file', id)}
    />
  )
}
