import { toId } from '@shared/ids'
import { referencePattern } from '@shared/text'
import { USER, resolveEntry, type Kind, type KindContext } from './kinds'

export function fieldText(kind: Kind, id: string, part: string, ctx: KindContext = USER): string | null {
  const key = toId(part)
  return kind.fields?.(id, ctx).find((f) => toId(f.name) === key)?.text ?? null
}

export function entryField(entry: string, part: string, ctx: KindContext = USER): string | null {
  try {
    const { kind, id } = resolveEntry(entry, null, ctx)
    return fieldText(kind, id, part, ctx)
  } catch {
    return null
  }
}

export function entryFields(entry: string, ctx: KindContext = USER): string[] {
  try {
    const { kind, id } = resolveEntry(entry, null, ctx)
    return (kind.fields?.(id, ctx) ?? []).map((f) => f.name)
  } catch {
    return []
  }
}

export function resolveIncludes(text: string, ctx: KindContext = USER): string {
  return text.replace(referencePattern(), (whole, lead: string, kind: string, ref: string, part: string | undefined) => {
    if (!part) return whole
    const found = entryField(`@${kind}:${ref}`, part, ctx)
    return found === null ? whole : `${lead}${found}`
  })
}
