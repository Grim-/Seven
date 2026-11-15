import { useState } from 'react'
import { Plus } from 'lucide-react'
import { showName } from '@shared/ids'
import { Button, Select } from '../ui'
import { usePage } from '../../store/data'
import { SET_TYPE, readCounts, useTypePages, type CardCounts } from './model'

export function SetPicker({ onAdd }: { onAdd: (set: CardCounts) => void }) {
  const sets = useTypePages(SET_TYPE)
  const [picked, setPicked] = useState('')
  const page = usePage(picked || null)
  return (
    <div className="flex items-center gap-1.5">
      <Select value={picked} options={[{ value: '', label: 'Pick a card set' }, ...sets.map((s) => ({ value: s.id, label: showName(s.title) }))]} onChange={setPicked} className="h-7 flex-1 text-[12px]" />
      <Button size="sm" icon={<Plus />} disabled={!page} onClick={() => page && onAdd(readCounts(page.data, page.title))}>
        Add set
      </Button>
    </div>
  )
}
