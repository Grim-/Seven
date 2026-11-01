import { COLLECTION_VIEWS, type WidgetSource } from '@shared/types'
import { data } from '../data/hub'
import { DataError } from '../data/validate'
import type { KindWidget } from '../data/widgetSources'

interface PageSource extends WidgetSource {
  kind: 'page'
  pageId: string
}

const pageOf = (source: WidgetSource) => data.pageInfo(String((source as PageSource).pageId ?? ''))

function newTextTitle(): string {
  for (let i = 1; ; i++) {
    const title = i === 1 ? 'Text' : `Text ${i}`
    if (!data.pages.find(title)) return title
  }
}

export const PAGE_WIDGET: KindWidget = {
  views: [...COLLECTION_VIEWS, 'text', 'addon'],
  defaultView: 'text',
  viewFor: (source) => pageOf(source).defaultView,
  check: (source) => {
    if (!(source as PageSource).pageId) throw new DataError('Give the title of the page to show, e.g. Shopping list.')
    return { kind: 'page', pageId: pageOf(source).id }
  },
  title: (source) => pageOf(source).title,
  describe: (source) => `page ${data.pages.metaFor(String((source as PageSource).pageId))?.title ?? (source as PageSource).pageId}`,
  fields: (source) => pageOf(source).fields,
  checkView: (source, view) => {
    const typed = pageOf(source).typed
    if (typed && view !== 'addon' && view !== 'text') throw new DataError(`A tool's page can't be shown as "${view}". Set view to addon or text, or leave it empty for the usual one.`)
    if (!typed && view === 'addon') throw new DataError(`addon is only for a tool's page. Set view to one of: ${[...COLLECTION_VIEWS, 'text'].join(', ')}, or leave it empty for the usual one.`)
  },
  create: {
    label: 'Text',
    size: { w: 4, h: 5 },
    make: (ctx) => ({ kind: 'page', pageId: data.pages.create({ title: newTextTitle(), body: '' }, ctx).id })
  },
  formerly: ['collection', 'note'],
  upgrade: (raw, view) => ({ source: { kind: 'page', pageId: String(raw.collectionId ?? raw.noteId ?? raw.pageId) }, view: view === 'markdown' ? 'text' : view })
}
