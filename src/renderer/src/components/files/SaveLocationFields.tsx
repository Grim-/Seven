import { useEffect, useState } from 'react'
import { Field, TagInput, Toggle } from '../ui'
import { FolderInput } from './FolderInput'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'

function TagsField({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) {
  const [known, setKnown] = useState<string[]>([])
  useEffect(() => {
    void engine('tags.list', { kind: null })
      .then((list) => setKnown(list.map((t) => t.tag)))
      .catch(failed('Could not read the tags'))
  }, [])
  return (
    <Field label="Tags">
      <TagInput value={value} onChange={onChange} suggestions={known} />
    </Field>
  )
}

export interface SaveLocation {
  folder: string
  remember: boolean
  tags: string[]
}

export function SaveLocationFields({
  value,
  onChange,
  rememberLabel,
  hint = 'Hold Shift to see this again. Change it in Settings.',
  withTags = true
}: {
  value: SaveLocation
  onChange: (next: SaveLocation) => void
  rememberLabel: string
  hint?: string
  withTags?: boolean
}) {
  return (
    <div className="flex flex-col gap-3">
      <Field label="Folder" hint="Made if it doesn't exist. Leave it empty for the top level.">
        <FolderInput value={value.folder} onChange={(folder) => onChange({ ...value, folder })} />
      </Field>
      {withTags && <TagsField value={value.tags} onChange={(tags) => onChange({ ...value, tags })} />}
      <div className="flex flex-col gap-1">
        <Toggle checked={value.remember} onChange={(remember) => onChange({ ...value, remember })} label={rememberLabel} />
        <span className="text-[11.5px] text-faint">{hint}</span>
      </div>
    </div>
  )
}
