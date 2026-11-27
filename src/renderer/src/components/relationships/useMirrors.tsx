import { useState, type ReactNode } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import { categoryForKind, newRelationshipId, parseLinkRef, type RelationshipEntry } from '@shared/relationships'
import type { MenuItem } from '../ui'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { failed } from '../../lib/notify'
import { openEntry } from '../../lib/library'
import { toast } from '../../store/toasts'
import { RelationshipEditor } from './RelationshipEditor'

export interface RelationOwner {
  ref: string
  title: string
}

interface Mirroring {
  holder: string
  name: string
  entry: RelationshipEntry
  fresh: boolean
}

function mirrorOf(owner: RelationOwner, entry: RelationshipEntry, back: RelationshipEntry | null): RelationshipEntry {
  if (back) return back
  const kind = parseLinkRef(owner.ref)?.kind ?? ''
  return { id: newRelationshipId(), target: owner.title, ref: owner.ref, category: categoryForKind(kind), role: '', stance: entry.stance, notes: '', updatedAt: Date.now() }
}

export function useMirrors(owner: RelationOwner | null, entries: RelationshipEntry[]): { mirrorItems: (entry: RelationshipEntry) => MenuItem[]; mirrorModal: ReactNode } {
  const refs = [...new Set(entries.flatMap((e) => (e.ref ? [e.ref] : [])))].sort()
  const backs = useLive(() => (owner && refs.length ? engine('relations.backs', { owner: owner.ref, refs }) : Promise.resolve({})), 'page.changed', [owner?.ref, refs.join('|')]) ?? {}
  const [mirroring, setMirroring] = useState<Mirroring | null>(null)

  const mirrorItems = (entry: RelationshipEntry): MenuItem[] => {
    if (!owner || !entry.ref || !(entry.ref in backs)) return []
    const back = backs[entry.ref]
    return [
      {
        label: back ? `Edit ${entry.target}'s side` : `Mirror on ${entry.target}`,
        icon: <ArrowLeftRight />,
        onSelect: () => setMirroring({ holder: entry.ref!, name: entry.target, entry: mirrorOf(owner, entry, back), fresh: !back })
      }
    ]
  }

  const save = (entry: RelationshipEntry) => {
    if (!mirroring) return
    const { holder, name } = mirroring
    const parsed = parseLinkRef(holder)
    void engine('relations.put', { holder, entry })
      .then(() => toast.success('Relationship saved', `${name} → ${entry.target}`, parsed ? { label: 'Open', onSelect: () => openEntry(parsed.kind, parsed.id) } : undefined))
      .catch(failed(`Could not save ${name}'s relationship`))
  }

  const mirrorModal = mirroring ? (
    <RelationshipEditor
      open
      initial={mirroring.entry}
      title={mirroring.fresh ? `${mirroring.name}'s side` : `Edit ${mirroring.name}'s side`}
      saveLabel={mirroring.fresh ? `Add to ${mirroring.name}` : 'Save changes'}
      onSave={save}
      onClose={() => setMirroring(null)}
    />
  ) : null

  return { mirrorItems, mirrorModal }
}
