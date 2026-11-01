import { useRef } from 'react'
import { engine } from '../../lib/ipc'
import { toast } from '../../store/toasts'
import { failed } from '../../lib/notify'

const DONE_ROLL = /@[a-z][\w.:-]*?:(?:"[^"]+"|[^\s,;!?)#]+)#random(?=[\s,.;!?)])/i

export async function rollAll(text: string): Promise<string> {
  if (!/#random/i.test(text)) return text
  const result = await engine('library.rollText', { text })
  for (const r of result.rolled) if (r.error) toast.error(`Could not roll ${r.token}`, r.error)
  return result.text
}

export function useRolls(enabled: boolean, value: string, onValue: (text: string) => void): (text: string) => void {
  const latest = useRef(value)
  latest.current = value
  const set = useRef(onValue)
  set.current = onValue
  return (text: string) => {
    if (!enabled || !DONE_ROLL.test(text)) return
    void engine('library.rollText', { text })
      .then((result) => {
        let next = latest.current
        for (const r of result.rolled) {
          if (r.error) toast.error(`Could not roll ${r.token}`, r.error)
          else next = next.replace(r.token, r.value)
        }
        if (next !== latest.current) set.current(next)
      })
      .catch(failed('Could not roll'))
  }
}
