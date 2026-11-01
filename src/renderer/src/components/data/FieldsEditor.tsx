import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { Page } from '@shared/types'
import { showName } from '@shared/ids'
import { AlertBox, Button, Modal } from '../ui'
import { engine } from '../../lib/ipc'
import { errorText } from '../../lib/format'
import { FieldRowEditor } from './fieldsEditor/FieldRowEditor'
import { changesFor, problemsOf, rowOf, type FieldRow } from './fieldsEditor/fieldChanges'

export function FieldsEditor({ page, onClose }: { page: Page; onClose: () => void }) {
  const [rows, setRows] = useState<FieldRow[]>(() => (page.fields.length ? page.fields.map((f) => rowOf(f)) : [rowOf(null, { name: 'title' }), rowOf(null, { name: 'done', type: 'boolean' })]))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const patch = (key: number, p: Partial<FieldRow>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)))
  const removing = page.fields.filter((f) => !rows.some((r) => r.original === f))
  const problems = problemsOf(rows)

  const save = async () => {
    setError(null)
    setBusy(true)
    try {
      await engine('data.pages.fields', { id: page.id, changes: changesFor(rows, page.fields) })
      onClose()
    } catch (err) {
      setError(errorText(err))
    }
    setBusy(false)
  }

  return (
    <Modal
      open
      title={`Fields of ${showName(page.title)}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={busy || problems.length > 0} onClick={() => void save()}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex max-h-[62vh] flex-col gap-2 overflow-y-auto pr-1">
        <div className="text-[12.5px] text-dim">Every item on this page has these fields.</div>
        {rows.map((r) => (
          <FieldRowEditor key={r.key} row={r} onChange={(p) => patch(r.key, p)} onRemove={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} />
        ))}
        <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => setRows((rs) => [...rs, rowOf(null)])} className="self-start">
          Add field
        </Button>
        {removing.length > 0 && (
          <AlertBox>
            Removing {removing.map((f) => f.name).join(', ')} deletes {removing.length === 1 ? 'its value' : 'their values'} from every item.
          </AlertBox>
        )}
        {problems.map((p) => (
          <div key={p} className="border border-accent/40 bg-accent/5 px-3 py-2 text-[12.5px] text-accent-soft">
            {p}
          </div>
        ))}
        {error && <AlertBox>{error}</AlertBox>}
      </div>
    </Modal>
  )
}
