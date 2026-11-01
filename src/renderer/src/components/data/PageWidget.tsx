import { Type } from 'lucide-react'
import { COLLECTION_VIEWS, type CollectionViewKind, type WidgetSource } from '@shared/types'
import { CollectionBody } from './CollectionView'
import { NoteBody } from './NoteView'
import { ModulePageView } from '../present/template'
import { PagePick } from './PagePick'
import { useData, usePage } from '../../store/data'
import { MissingWidget, type WidgetBodyProps, type WidgetEditorProps, type WidgetUi } from '../../registries/widgets'

const pageIdOf = (source: WidgetSource) => String(source.pageId ?? '')

function PageWidgetBody({ widget, compact }: WidgetBodyProps) {
  const page = usePage(pageIdOf(widget.source))
  if (page === undefined) return <div className="font-mono text-[11px] text-dim">Loading…</div>
  if (!page) return <MissingWidget what="page" />
  if (widget.view === 'addon')
    return (
      <div className="h-full overflow-y-auto">
        <ModulePageView pageId={page.id} version={page.version} part="widget" />
      </div>
    )
  if (widget.view === 'text') return <NoteBody page={page} maxHeight="max-h-none" readOnly={widget.options.editable === false} heading={false} />
  return <CollectionBody page={page} view={widget.view as CollectionViewKind} recordIds={null} options={widget.options} compact={compact} />
}

function PageWidgetEditor({ source, onChange }: WidgetEditorProps) {
  return <PagePick label="Page" value={pageIdOf(source)} optional={false} onChange={(pageId) => onChange({ ...source, pageId })} />
}

export const PAGE_WIDGET_UI: WidgetUi = {
  Body: PageWidgetBody,
  Editor: PageWidgetEditor,
  blank: () => ({ kind: 'page', pageId: useData.getState().pages[0]?.id ?? '' }),
  createIcon: <Type />,
  entry: (source) => `page/${pageIdOf(source)}`,
  switchViews: (widget) => ((COLLECTION_VIEWS as readonly string[]).includes(widget.view) ? [...COLLECTION_VIEWS, 'text'] : []),
  fieldsPage: (source) => pageIdOf(source) || null
}
