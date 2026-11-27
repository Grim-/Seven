import { Fragment, type ReactNode } from 'react'
import { showName } from '@shared/ids'
import { EmptyState, InlineTitle, SaveState, type SaveStatus } from '../ui'
import { usePage } from '../../store/data'
import { renamePage } from '../../lib/modulePage'

export function AddonPage<T>({ id, what, read, render }: { id: string | null; what: string; read: (data: unknown, title: string) => T; render: (page: { pageId: string; title: string; start: T }) => ReactNode }) {
  const page = usePage(id)
  if (page === undefined) return <div className="font-ui text-[11px] text-dim">Loading…</div>
  if (!page) return <EmptyState title="Deleted">This {what} no longer exists.</EmptyState>
  return <Fragment key={page.id}>{render({ pageId: page.id, title: page.title, start: read(page.data, page.title) })}</Fragment>
}

export function AddonTitle({ pageId, title, status, error, icon, onRenamed }: { pageId: string; title: string; status: SaveStatus; error: string | null; icon?: ReactNode; onRenamed?: (next: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      {icon}
      <InlineTitle
        value={showName(title)}
        onSave={(next) => {
          renamePage(pageId, next)
          onRenamed?.(next)
        }}
      />
      <SaveState status={status} error={error} />
    </div>
  )
}
