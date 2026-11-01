import type { WidgetSource } from '@shared/types'
import { data } from './hub'
import { DataError } from './validate'
import { registerWidgetProvider } from './widgetSources'

const MAX_HTML = 200_000

registerWidgetProvider({
  kind: 'html',
  label: 'HTML',
  views: ['html'],
  defaultView: 'html',
  check: (source: WidgetSource) => {
    const html = typeof source.html === 'string' ? source.html : ''
    if (!html.trim()) throw new DataError('Give the HTML of the page to show, a complete <html> document.')
    if (html.length > MAX_HTML) throw new DataError('That HTML is over 200 KB, the most a dashboard widget holds. Make it shorter, or save it with add_html and show it in the chat instead.')
    return { kind: 'html', html, collectionId: typeof source.collectionId === 'string' && source.collectionId ? data.pageInfo(source.collectionId).id : null }
  },
  title: () => 'Page',
  describe: () => 'html',
  create: {
    label: 'Page',
    make: () => ({ kind: 'html', html: '<div style="padding:12px;font-family:sans-serif;color:#ddd">Edit this page from the item settings.</div>', collectionId: null })
  }
})
