import type { GgufView } from '../view'

export function resolveChatTemplate(v: GgufView): boolean {
  const t = v.tokenizer.chat_template
  return typeof t === 'string' || (typeof t === 'object' && t !== null)
}
