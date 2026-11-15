import { useEffect, useState } from 'react'
import { Select } from '../../ui'
import { engine } from '../../../lib/ipc'
import { noteFailure } from '../../../store/problems'

export function SheetSelect({ value, onChange, className, noneLabel = 'None' }: { value: string | null; onChange: (id: string | null, title: string | null) => void; className?: string; noneLabel?: string }) {
  const [list, setList] = useState<{ id: string; title: string }[]>([])
  useEffect(() => {
    void engine('library.find', { query: '', kind: 'sheet' })
      .then((hits) => setList(hits.map((h) => ({ id: h.id, title: h.title }))))
      .catch(noteFailure('sheets', 'Could not list the sheets', () => setList([])))
  }, [])
  return <Select value={value ?? ''} options={[{ value: '', label: noneLabel }, ...list.map((s) => ({ value: s.id, label: s.title }))]} onChange={(v) => onChange(v || null, list.find((s) => s.id === v)?.title ?? null)} className={className} />
}
