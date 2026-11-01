import { useMemo, type ReactNode } from 'react'
import { CornerLeftUp, File, FileText, Folder } from 'lucide-react'
import { FOLDER_TYPE, showName } from '@shared/ids'
import { pageKindOf, type AssetMeta, type PageMeta } from '@shared/types'
import { KindShell, TileIcon, menuAdds, openMenu, type ShellItem } from '../ui'
import { useData } from '../../store/data'
import { AssetMedia } from '../pictures/AssetMedia'
import { KindIcon, openEntry } from '../../lib/library'
import { folderNewItems, usePageTypes } from './PageView'
import { rowMenu } from '../../views/data/entryMenu'
import { bulkItems, moveEntries } from './bulkMenu'
import { presentOf } from '../../registries/kinds'

const UP = '__up'
const VIEWABLE: AssetMeta['kind'][] = ['image', 'video']

export function PageExplorer({ folder, header, onOpen, onOpenFile = (id) => openEntry('file', id), onMenu }: { folder: string | null; header?: ReactNode; onOpen: (id: string | null) => void; onOpenFile?: (id: string) => void; onMenu?: (e: React.MouseEvent, page: PageMeta) => void }) {
  const pages = useData((s) => s.pages)
  const assets = useData((s) => s.assets)
  const types = usePageTypes()
  const { byId, kids, files, filesById, counts } = useMemo(() => {
    const byId = new Map(pages.map((p) => [p.id, p]))
    const counts = new Map<string, number>()
    const kids: PageMeta[] = []
    const files: AssetMeta[] = []
    for (const p of pages) {
      const parent = p.parent && byId.has(p.parent) ? p.parent : null
      if (parent) counts.set(parent, (counts.get(parent) ?? 0) + 1)
      if (parent === folder) kids.push(p)
    }
    for (const a of assets) {
      const parent = a.parent && byId.has(a.parent) ? a.parent : null
      if (parent) counts.set(parent, (counts.get(parent) ?? 0) + 1)
      if (parent === folder) files.push(a)
    }
    return { byId, kids, files, filesById: new Map(files.map((a) => [a.id, a])), counts }
  }, [pages, assets, folder])

  const up = folder ? (byId.get(folder)?.parent ?? null) : undefined
  const parent = up && byId.has(up) ? up : null
  const items: ShellItem[] = kids.map((p) => {
    const isFolder = p.type === FOLDER_TYPE
    const type = p.type ? types.find((t) => t.id === p.type) : undefined
    const inside = counts.get(p.id) ?? 0
    const Face = p.type ? presentOf(pageKindOf(p.type)).Face : undefined
    return {
      key: p.id,
      title: showName(p.title),
      subtitle: isFolder ? `${inside} inside` : type ? type.label : p.count ? `${p.count} item${p.count === 1 ? '' : 's'}` : p.summary,
      icon: isFolder ? <Folder className="h-4 w-4" /> : type ? <KindIcon name={type.icon} className="h-4 w-4" /> : <FileText className="h-4 w-4" />,
      tile: isFolder ? <TileIcon shape="folder" /> : <TileIcon shape="page" glyph={type ? <KindIcon name={type.icon} /> : undefined} />,
      thumb: p.image ? <AssetMedia id={p.image} className="h-full w-full" /> : undefined,
      face: Face ? <Face id={p.id} /> : undefined,
      updatedAt: p.updatedAt,
      tag: isFolder ? 'DIR' : (type?.label ?? 'Page').toUpperCase(),
      group: isFolder ? 0 : 1,
      target: isFolder
    }
  })
  for (const a of files) {
    const ext = (/\.([A-Za-z0-9]{1,5})$/.exec(a.name)?.[1] ?? a.kind).toUpperCase()
    items.push({
      key: a.id,
      title: a.name,
      subtitle: `${a.kind}, ${Math.max(1, Math.round(a.size / 1024))} KB`,
      icon: <File className="h-4 w-4" />,
      tile: <TileIcon shape="file" label={ext} />,
      tag: ext,
      thumb: VIEWABLE.includes(a.kind) ? <AssetMedia id={a.id} className="h-full w-full" /> : undefined,
      updatedAt: a.createdAt,
      group: 2
    })
  }
  if (up !== undefined) items.unshift({ key: UP, title: '...', icon: <CornerLeftUp className="h-4 w-4" />, group: -1, target: true })

  return (
    <KindShell
      layouts={['tiles', 'gallery', 'cards', 'deck', 'list']}
      id={`pages.${folder ?? ''}`}
      inherit="pages"
      items={items}
      header={header}
      pickable
      onOpen={(item) => {
        if (!filesById.has(item.key)) return onOpen(item.key === UP ? parent : item.key)
        onOpenFile(item.key)
      }}
      onMenu={(e, item, picked) => {
        const many = picked.filter((k) => k !== UP)
        if (many.length > 1) return openMenu(e, `${many.length} items`, bulkItems(many))
        const file = filesById.get(item.key)
        if (file) return rowMenu('file', file.id, file.name, () => onOpenFile(file.id))(e)
        const p = byId.get(item.key)
        if (!p) return
        if (onMenu) onMenu(e, p)
        else rowMenu(pageKindOf(p.type), p.id, p.title, () => onOpen(p.id))(e)
      }}
      onMove={(keys, target) => void moveEntries(keys.filter((k) => k !== UP), target === UP ? parent : target)}
      adds={menuAdds(folderNewItems(types, (id) => onOpen(id), folder))}
    />
  )
}
