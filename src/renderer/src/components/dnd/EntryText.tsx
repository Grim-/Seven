import { useMemo } from 'react'
import { blockRuns, entrySections, levelRows, type EntryBlock } from '@shared/compendium'
import { Eyebrow } from '../ui'
import { openEntry } from '../../lib/library'
import { Markdown } from '../chat/Markdown'
import { LevelTable } from './LevelTable'

function Md({ text }: { text: string }) {
  return <Markdown text={text} onEntry={(k, ref) => (openEntry(k, ref), true)} />
}

function Cards({ blocks }: { blocks: EntryBlock[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(19rem,1fr))] gap-2">
      {blocks.map((b, i) => (
        <div key={i} className="flex flex-col gap-1 border border-line/40 tone-panel-40 px-3 py-2">
          <span className="text-[13px] font-semibold text-accent-soft">{b.title}</span>
          {b.body && (
            <div className="text-[13px] leading-relaxed text-ink/85">
              <Md text={b.body} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function Prose({ blocks, owner }: { blocks: EntryBlock[]; owner: string }) {
  return (
    <>
      {blocks.map((b, i) => {
        const rows = levelRows(b.body)
        if (rows) return <LevelTable key={i} rows={rows} owner={owner} />
        return (
          <div key={i} className="border border-line/40 tone-panel-40 px-4 py-3 text-[14px] leading-relaxed text-ink/90">
            <div className="max-w-[80ch]">
              <Md text={b.body} />
            </div>
          </div>
        )
      })}
    </>
  )
}

export function EntryText({ text, owner = '' }: { text: string; owner?: string }) {
  const groups = useMemo(() => entrySections(text), [text])
  return (
    <div className="flex flex-col gap-5">
      {groups.map((g, gi) => {
        const body = blockRuns(g.blocks).map((run, ri) => (run.titled ? <Cards key={ri} blocks={run.blocks} /> : <Prose key={ri} blocks={run.blocks} owner={owner} />))
        if (g.heading && g.level > 2)
          return (
            <section key={gi} className="flex flex-col gap-2 border-l-2 border-accent/50 pl-3">
              <h4 className="text-[15px] font-semibold text-ink">{g.heading}</h4>
              {body}
            </section>
          )
        return (
          <section key={gi} className="flex flex-col gap-2">
            {g.heading && <Eyebrow className="border-b border-line/40 pb-1">{g.heading}</Eyebrow>}
            {body}
          </section>
        )
      })}
    </div>
  )
}
