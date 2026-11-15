import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { ShellSweep } from './ShellParts'

export type FaceFrame = 'notched' | 'rounded' | 'playing'

export type FaceSlot = 'tags' | 'marks' | 'art' | 'title' | 'type' | 'body' | 'stats' | 'foot'

export interface FaceStat {
  key: string
  label: string
  value: string
}

export interface ShellFaceProps {
  title: string
  label?: string
  tags?: string[]
  marks?: string[]
  aside?: string
  art?: ReactNode
  type?: string
  body?: ReactNode
  sections?: ReactNode
  stats?: FaceStat[]
  foot?: string
  corners?: [string[], string[]]
  color?: string | null
  frame?: FaceFrame
  edit?: FaceEdit
  className?: string
}

function Tags({ list }: { list: string[] }) {
  return list.map((t, i) => (
    <span key={i} className="shell-tag shell-face-tag">
      {t}
    </span>
  ))
}

function Corner({ list, at }: { list: string[]; at: string }) {
  return <span className={`shell-face-corner ${at}`}>{list.map((v, i) => <span key={i}>{v}</span>)}</span>
}

export interface FaceEdit {
  picked: FaceSlot | null
  hint: (slot: FaceSlot) => string
  onSlot: (slot: FaceSlot, e: MouseEvent<HTMLElement>) => void
}

function Region({ slot, edit, className, children, inline = false }: { slot: FaceSlot; edit?: FaceEdit; className?: string; children: ReactNode; inline?: boolean }) {
  const empty = children === undefined || children === null || children === false || children === ''
  if (!edit) return empty ? null : inline ? <>{children}</> : <div className={className}>{children}</div>
  const Tag = inline ? 'span' : 'div'
  return (
    <Tag
      onClick={(e) => edit.onSlot(slot, e)}
      onContextMenu={(e) => {
        e.preventDefault()
        edit.onSlot(slot, e)
      }}
      className={cn(className, 'cursor-pointer outline outline-1 -outline-offset-1 outline-dashed', edit.picked === slot ? 'outline-solid outline-cyan' : 'outline-line/60 hover:outline-cyan/70', inline && 'inline-flex min-h-4 min-w-10 items-center gap-1 px-1')}
    >
      {empty ? <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">{edit.hint(slot)}</span> : children}
    </Tag>
  )
}

export function ShellFace({ title, label, tags = [], marks = [], aside, art, type, body, sections, stats = [], foot, corners, color, frame = 'notched', edit, className }: ShellFaceProps) {
  const style = (color ? { '--c': color } : {}) as CSSProperties
  if (frame === 'playing' && !edit) {
    const [left, right] = corners ?? [[], []]
    return (
      <div className={cn('shell-slate shell-face', className)} data-frame="playing" style={style}>
        <Corner list={left} at="tl" />
        <Corner list={right} at="tr" />
        <div className="shell-face-mid">
          {art && <div className="shell-art shell-face-art">{art}</div>}
          <div className="shell-face-title">{title}</div>
          {type && <div className="shell-face-type">{type}</div>}
          {body && <div className="shell-face-body">{body}</div>}
          {sections && <div className="shell-face-sections">{sections}</div>}
        </div>
        <Corner list={left} at="br" />
        <Corner list={right} at="bl" />
      </div>
    )
  }
  const head = edit || label || tags.length || marks.length || aside
  return (
    <div className={cn('shell-slate shell-face', className)} data-frame={edit ? 'notched' : frame} style={style}>
      <ShellSweep />
      {head && (
        <div className="shell-face-head">
          {label && <span className="truncate">{label}</span>}
          <Region slot="tags" edit={edit} inline>
            {tags.length ? <Tags list={tags} /> : undefined}
          </Region>
          <span className="flex-1" />
          <Region slot="marks" edit={edit} inline>
            {marks.length ? <Tags list={marks} /> : undefined}
          </Region>
          {!marks.length && !edit && aside && <span className="shrink-0 font-normal text-faint">{aside}</span>}
        </div>
      )}
      <Region slot="art" edit={edit} className="shell-art shell-face-art">
        {art}
      </Region>
      <Region slot="title" edit={edit} className="shell-face-title">
        {title}
      </Region>
      <Region slot="type" edit={edit} className="shell-face-type">
        {type}
      </Region>
      <Region slot="body" edit={edit} className="shell-face-body">
        {body}
      </Region>
      {sections && <div className="shell-face-sections">{sections}</div>}
      <Region slot="stats" edit={edit} className="shell-face-stats">
        {stats.length
          ? stats.map((s) => (
              <span key={s.key}>
                <i>{s.label}</i>
                {s.value}
              </span>
            ))
          : undefined}
      </Region>
      <Region slot="foot" edit={edit} className="shell-face-foot">
        {foot}
      </Region>
    </div>
  )
}
