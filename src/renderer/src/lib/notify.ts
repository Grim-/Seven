import { toast } from '../store/toasts'
import { errorText } from './format'
import { main, requestOf } from './ipc'

export function failed(what: string): (err: unknown) => void {
  return (err) => toast.error(what, errorText(err), { request: requestOf(err), detail: err instanceof Error ? err.stack : undefined })
}

export function copyText(text: string, what = 'Copied', shown: string = text.slice(0, 80)): Promise<void> {
  return main('clipboard.write', { text }).then(
    () => toast.success(what, shown),
    () => toast.error('Could not copy', 'The clipboard is not available.')
  )
}
