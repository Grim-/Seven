import { Field, Select } from '../ui'
import { useData } from '../../store/data'

export function PagePick({ label, value, optional, onChange }: { label: string; value: string; optional: boolean; onChange: (id: string) => void }) {
  const pages = useData((s) => s.pages)
  return (
    <Field label={label}>
      <Select value={value} options={[...(optional ? [{ value: '', label: 'None' }] : []), ...pages.map((c) => ({ value: c.id, label: c.title }))]} onChange={onChange} />
    </Field>
  )
}
