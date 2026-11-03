import { useEffect, useState } from 'react'
import type { LibrarySection } from '@shared/types'
import { engine } from '../lib/ipc'
import { showInData } from '../lib/library'
import { failed } from '../lib/notify'
import { LockedState, useLocked } from '../components/vault/Vault'
import { PagesBrowser } from './PagesView'

export function FilesView() {
  const locked = useLocked()
  const [section, setSection] = useState<LibrarySection | null>(null)
  useEffect(() => {
    if (locked) return
    void engine('library.overview', { query: '', perKind: 0, kind: 'page' })
      .then((found) => setSection(found[0] ?? null))
      .catch(failed('Could not load your files'))
  }, [locked])
  if (locked) return <div className="h-full p-3"><LockedState what="Your files" /></div>
  if (!section) return null
  return <PagesBrowser section={section} select={showInData} />
}
