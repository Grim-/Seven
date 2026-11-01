import { IN_APP } from './mode'
import { engine, main } from './ipc'
import { openEntry } from './library'
import { kindUi } from '../registries/kinds'
import { failed } from '../lib/notify'


export function sevenHref(kind: string, ref = ''): string {
  return `seven:${kind}${ref ? `/${encodeURIComponent(ref)}` : ''}`
}

export function openSevenLink(href: string): void {
  if (!IN_APP) {
    void main('app.show', { sessionId: null })
    return
  }
  const body = href
    .replace(/^seven:\/*/, '')
    .split('/')
    .map((p) => decodeURIComponent(p))
    .join('/')
    .trim()
  const [kind, ...rest] = body.split('/')
  if (!rest.length && kindUi(kind).whole) return openEntry(kind, 'all')
  void engine('library.resolve', { entry: body })
    .then(({ kind: k, id }) => openEntry(k, id))
    .catch(failed('Not found'))
}
