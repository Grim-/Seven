export interface ChatElement {
  type: string
  data: Record<string, unknown>
}

const isElement = (v: unknown): v is ChatElement => {
  if (!v || typeof v !== 'object') return false
  const e = v as Partial<ChatElement>
  return typeof e.type === 'string' && e.type !== '' && !!e.data && typeof e.data === 'object' && !Array.isArray(e.data)
}

export function cleanElements(value: unknown): ChatElement[] {
  return Array.isArray(value) ? value.filter(isElement).map((e) => ({ type: e.type, data: e.data })) : []
}
