import { useEffect, useMemo, type ReactNode } from 'react'
import { BookOpen, File, FilePlus, FileText, Folder, FolderPlus, Upload } from 'lucide-react'
import { FOLDER_TYPE, showName } from '@shared/ids'
import { pageKindOf, type AssetMeta, type PageMeta } from '@shared/types'
import { KindShell, TileIcon, openMenu, type ShellItem } from '../ui'
import { ancestorsOf, useData } from '../../store/data'
import { AssetMedia } from '../pictures/AssetMedia'
import { KindIcon } from '../../lib/library'
import { askNewFolder, folderNewItems, newPageMenu, renamePage, usePageTypes } from './PageView'
import { rowMenu } from '../../views/data/entryMenu'
import { bulkItems, moveEntries } from './bulkMenu'
import { presentOf } from '../../registries/kinds'
import { FolderPath } from './FolderPath'
import { chooseFiles } from '../../lib/importFiles'
import { CopyLinkButton } from './CopyLinkButton'
import { VIEWABLE_MEDIA_KINDS } from '../pictures/FileEditor'

const VIEWABLE = VIEWABLE_MEDIA_KINDS
const INDEX_ID = 'all:wiki-index'
const INDEX_TITLE = 'Wiki index'

export function PageExplorer({ folder, header, onOpen, onOpenFile = onOpen, onMenu }: { folder: string | null; header?: ReactNode; onOpen: (id: string | null) => void; onOpenFile?: (id: string) => void; onMenu?: (e: React.MouseEvent, page: PageMeta) => void }) {
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

  const currentFolder = folder ? (byId.get(folder) ?? null) : null
  const trail = useMemo(() => (folder ? ancestorsOf(folder, byId) : []), [folder, byId])
  const up = folder ? (currentFolder?.parent ?? null) : undefined
  const parent = up && byId.has(up) ? up : null

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        (e.altKey && e.key === 'ArrowUp') ||
        (e.key === 'Backspace' && (e.target as HTMLElement)?.tagName !== 'INPUT' && (e.target as HTMLElement)?.tagName !== 'TEXTAREA')
      ) {
        if (folder !== null) {
          e.preventDefault()
          onOpen(parent)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [folder, parent, onOpen])

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

  const navHeader = header ?? (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <FolderPath
        trail={trail}
        current={currentFolder ? showName(currentFolder.title) : ''}
        up={folder ? parent : undefined}
        onPick={onOpen}
        rename={currentFolder ? { value: currentFolder.title, onSave: (title) => void renamePage(currentFolder.id, title) } : undefined}
      />
      <div className="flex items-center gap-1 border-l border-line/40 pl-2">
        <button
          type="button"
          title="New folder"
          onClick={() => askNewFolder((id) => onOpen(id), folder)}
          className="flex items-center gap-1 border border-line/50 bg-black/40 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-dim hover:border-accent/60 hover:text-white transition-colors"
        >
          <FolderPlus className="h-3 w-3 text-accent-soft" />
          <span className="hidden sm:inline">Folder</span>
        </button>
        <button
          type="button"
          title="New page"
          onClick={(e) => newPageMenu(e, types, (id) => onOpen(id), folder)}
          className="flex items-center gap-1 border border-line/50 bg-black/40 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-dim hover:border-accent/60 hover:text-white transition-colors"
        >
          <FilePlus className="h-3 w-3 text-accent-soft" />
          <span className="hidden sm:inline">Page</span>
        </button>
        <button
          type="button"
          title="Add files"
          onClick={() => void chooseFiles(folder)}
          className="flex items-center gap-1 border border-line/50 bg-black/40 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-dim hover:border-accent/60 hover:text-white transition-colors"
        >
          <Upload className="h-3 w-3 text-accent-soft" />
          <span className="hidden sm:inline">Upload</span>
        </button>
        {folder && <CopyLinkButton kind="folder" id={folder} />}
        {!folder && (
          <button
            type="button"
            title="Wiki index (all pages and folders)"
            onClick={() => onOpen(INDEX_ID)}
            className="flex items-center gap-1 border border-line/40 bg-black/40 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-dim hover:border-accent/60 hover:text-white transition-colors"
          >
            <BookOpen className="h-3 w-3 text-accent-soft" />
            <span className="hidden md:inline">{INDEX_TITLE}</span>
          </button>
        )}
      </div>
    </div>
  )

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      onContextMenu={(e) => {
        if ((e.target as HTMLElement).closest('button, [data-shell-item]')) return
        openMenu(e, 'New', folderNewItems(types, (id) => onOpen(id), folder))
      }}
    >
      <KindShell
        layouts={['tiles', 'gallery', 'cards', 'deck', 'list']}
        id={`pages.${folder ?? ''}`}
        inherit="pages"
        items={items}
        header={navHeader}
        pickable
        onOpen={(item) => {
          if (!filesById.has(item.key)) return onOpen(item.key)
          onOpenFile(item.key)
        }}
        onMenu={(e, item, picked) => {
          if (picked.length > 1) return openMenu(e, `${picked.length} items`, bulkItems(picked))
          const file = filesById.get(item.key)
          if (file) return rowMenu('file', file.id, file.name, () => onOpenFile(file.id))(e)
          const p = byId.get(item.key)
          if (!p) return
          if (onMenu) onMenu(e, p)
          else rowMenu(pageKindOf(p.type), p.id, p.title, () => onOpen(p.id))(e)
        }}
        onMove={(keys, target) => void moveEntries(keys, target)}
      />
    </div>
  )
}

