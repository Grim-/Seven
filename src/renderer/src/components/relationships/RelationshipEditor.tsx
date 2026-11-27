import { useState } from 'react'
import { cleanRelationship, newRelationshipId, type RelationCategory, type RelationshipEntry } from '@shared/relationships'
import { Button, Modal } from '../ui'
import { RelationshipForm } from './RelationshipForm'

export function blankRelationship(category: RelationCategory = 'person', target = ''): RelationshipEntry {
  return { id: newRelationshipId(), target, category, role: '', stance: 'neutral', notes: '', updatedAt: Date.now() }
}

export function RelationshipEditor({
  open,
  initial,
  title,
  saveLabel,
  onSave,
  onClose
}: {
  open: boolean
  initial: RelationshipEntry | null
  title?: string
  saveLabel?: string
  onSave: (entry: RelationshipEntry) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<RelationshipEntry>(() => initial ?? blankRelationship())

  const commit = () => {
    const cleaned = cleanRelationship({ ...draft, updatedAt: Date.now() })
    if (!cleaned) return
    onSave(cleaned)
    onClose()
  }

  return (
    <Modal
      open={open}
      wide
      title={title ?? (initial ? `Edit · ${initial.target}` : 'Add relationship')}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!draft.target.trim()} onClick={commit}>
            {saveLabel ?? (initial ? 'Save changes' : 'Add relationship')}
          </Button>
        </>
      }
    >
      <div className="flex min-h-[28rem] flex-col">
        <RelationshipForm autoFocus value={draft} onChange={setDraft} />
      </div>
    </Modal>
  )
}
