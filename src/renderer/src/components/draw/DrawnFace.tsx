import { referencePattern } from '@shared/text'
import { ShellFace } from '../ui'
import { EntryFace } from '../entries/EntryFace'

export function isLinkOnly(value: string): boolean {
  const m = [...value.trim().matchAll(referencePattern())]
  return m.length === 1 && m[0][0].trim() === value.trim()
}

export function DrawnFace({ value, from }: { value: string; from: string }) {
  if (isLinkOnly(value)) return <EntryFace link={value.trim()} />
  return <ShellFace title={from} label="DRAWN" body={value} />
}
