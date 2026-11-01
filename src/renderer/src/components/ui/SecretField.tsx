import { useState } from 'react'
import { Button } from './Button'
import { Input } from './inputs'

export function SecretField({ set, onSave, placeholder = 'Paste key' }: { set: boolean; onSave: (next: string | null) => Promise<unknown>; placeholder?: string }) {
  const [value, setValue] = useState('')
  const save = (next: string | null) => void onSave(next).then(() => setValue(''))
  return (
    <div className="flex items-center gap-2">
      <Input type="password" autoComplete="off" value={value} onChange={(e) => setValue(e.target.value)} placeholder={set ? 'Replace…' : placeholder} className="h-8 w-56 text-[12px]" />
      <Button size="sm" variant="primary" disabled={!value.trim()} onClick={() => save(value.trim())}>
        Save
      </Button>
      {set && (
        <Button size="sm" variant="ghost" onClick={() => save(null)}>
          Remove
        </Button>
      )}
    </div>
  )
}
