import { useEffect, useState } from 'react'
import { ListPane, ListToggle, MainPane, ReadingPane, SearchBox, Split } from '../../components/ui'
import { useListPrefs } from '../../lib/listPrefs'
import { useCompactLayout } from '../../lib/form'
import { useLibrary } from '../../lib/library'
import { useData } from '../../store/data'
import { Everything } from './Everything'
import { KindHeader } from './KindHeader'
import { KindPane } from './KindPane'
import { kindUi, ownViewKinds } from '../../registries/kinds'
import { KindRail } from './KindRail'
import { rememberSections } from './entryMenu'
import { useRememberedLocation } from '../../lib/window'
import type { DataSelection } from '../../store/data'
import { noteFailure } from '../../store/problems'

function useQuery(): [string, string, (q: string) => void] {
  const [query, setQuery] = useState('')
  const [q, setQ] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setQ(query.trim()), 250)
    return () => clearTimeout(timer)
  }, [query])
  return [query, q, setQuery]
}

export function DataWindow() {
  const skip = ownViewKinds()
  const { sections } = useLibrary('', 8, skip)
  const start = sections?.find((s) => kindUi(s.kind).start)
  const [selected, select] = useRememberedLocation<DataSelection | null>(start ? { kind: start.kind, id: 'all' } : null)
  const [prefs, save] = useListPrefs('dataList', { open: true, width: 248 })
  const compact = useCompactLayout()
  const closed = new Set(prefs.closed ?? [])
  const [query, q, setQuery] = useQuery()
  const { sections: found } = useLibrary(q, 20, skip)
  useEffect(() => {
    if (sections) rememberSections(sections)
  }, [sections])
  useEffect(() => {
    void useData
      .getState()
      .refresh()
      .catch(noteFailure('library', 'Could not refresh the library'))
  }, [])

  const kind = selected ? (kindUi(selected.kind).showsAs ?? selected.kind) : null
  const Browser = kind ? kindUi(kind).browser : undefined
  const section = sections?.find((s) => s.kind === kind) ?? null

  const search = (
    <SearchBox
      value={query}
      onChange={(v) => {
        setQuery(v)
        if (v.trim()) select(null)
      }}
      placeholder="Search everything · #tag"
    />
  )
  const toggle = (
    <ListToggle
      open={prefs.open}
      onToggle={() => save({ open: !prefs.open })}
      what="the list of kinds"
    />
  )

  if (sections && selected && section && Browser)
    return (
      <div className="h-full min-h-0 p-3 tablet:p-0">
        <Browser section={section} select={select} onBack={() => select(null)} />
      </div>
    )

  return (
    <div
      className="h-full min-h-0 p-3 tablet:p-0"
    >
      <Split>
        <ListPane
          id="data"
          open={prefs.open}
          width={prefs.width}
          min={200}
          max={420}
          reset={248}
          onWidth={(width) => save({ width })}
          onClose={() => save({ open: false })}
        >
          <aside className="panel-box flex h-full w-full flex-col">
            <div className="border-b border-line/40 p-2">{search}</div>
            <KindRail
              sections={sections ?? []}
              current={kind}
              closed={closed}
              onPick={(k) => {
                setQuery('')
                select(k ? { kind: k, id: 'all' } : null)
                if (compact) save({ open: false })
              }}
              onToggle={(group) =>
                save({
                  closed: closed.has(group)
                    ? [...closed].filter((g) => g !== group)
                    : [...closed, group]
                })
              }
            />
          </aside>
        </ListPane>
        <MainPane id="data-main">
          <section className="flex h-full min-w-0 flex-1 flex-col gap-3">
            {sections === null ? (
              <div className="font-mono text-[11px] text-dim">Loading…</div>
            ) : selected && section ? (
              <>
                <KindHeader section={section} selected={selected} select={select} lead={toggle} />
                <ReadingPane on={selected.id !== 'all'}>
                  <KindPane section={section} selected={selected} select={select} />
                </ReadingPane>
              </>
            ) : (
              <>
                <div className="flex shrink-0 items-center gap-3">
                  {toggle}
                  {!prefs.open && <div className="min-w-0 max-w-md flex-1">{search}</div>}
                </div>
                <Everything
                  sections={q ? (found ?? []) : sections}
                  query={q}
                  selected={selected}
                  select={select}
                />
              </>
            )}
          </section>
        </MainPane>
      </Split>
    </div>
  )
}
