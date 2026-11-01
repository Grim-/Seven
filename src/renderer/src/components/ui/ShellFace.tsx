import type { CSSProperties, ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { ShellSweep } from './ShellParts'

export type FaceFrame = 'notched' | 'rounded' | 'playing'

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
  stats?: FaceStat[]
  foot?: string
  corners?: [string[], string[]]
  color?: string | null
  frame?: FaceFrame
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

export function ShellFace({ title, label, tags = [], marks = [], aside, art, type, body, stats = [], foot, corners, color, frame = 'notched', className }: ShellFaceProps) {
  const style = (color ? { '--c': color } : {}) as CSSProperties
  if (frame === 'playing') {
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
        </div>
        <Corner list={left} at="br" />
        <Corner list={right} at="bl" />
      </div>
    )
  }
  const head = label || tags.length || marks.length || aside
  return (
    <div className={cn('shell-slate shell-face', className)} data-frame={frame} style={style}>
      <ShellSweep />
      {head && (
        <div className="shell-face-head">
          {label && <span className="truncate">{label}</span>}
          <Tags list={tags} />
          <span className="flex-1" />
          {marks.length ? <Tags list={marks} /> : aside && <span className="shrink-0 font-normal text-faint">{aside}</span>}
        </div>
      )}
      {art && <div className="shell-art shell-face-art">{art}</div>}
      <div className="shell-face-title">{title}</div>
      {type && <div className="shell-face-type">{type}</div>}
      {body && <div className="shell-face-body">{body}</div>}
      {stats.length > 0 && (
        <div className="shell-face-stats">
          {stats.map((s) => (
            <span key={s.key}>
              <i>{s.label}</i>
              {s.value}
            </span>
          ))}
        </div>
      )}
      {foot && <div className="shell-face-foot">{foot}</div>}
    </div>
  )
}
