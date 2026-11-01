import { useMemo } from 'react'
import { ancestorsOf, useAsset, useData } from '../../store/data'
import { showPage } from '../../views/PagesView'
import { FolderPath } from './FolderPath'
import { CopyLinkButton } from './CopyLinkButton'

export function fileFolder(id: string): string | null {
  const { assets, pages } = useData.getState()
  const parent = assets.find((a) => a.id === id)?.parent
  return parent && pages.some((p) => p.id === parent) ? parent : null
}

export function FileTrail({ id }: { id: string }) {
  const meta = useAsset(id)
  const pages = useData((s) => s.pages)
  const trail = useMemo(() => {
    const byId = new Map(pages.map((p) => [p.id, p]))
    const parent = meta?.parent ? byId.get(meta.parent) : undefined
    return parent ? [...ancestorsOf(parent.id, byId), parent] : []
  }, [pages, meta?.parent])
  if (!meta) return null
  return (
    <FolderPath trail={trail} current={meta.name} onPick={showPage}>
      <CopyLinkButton kind="file" id={id} />
    </FolderPath>
  )
}
