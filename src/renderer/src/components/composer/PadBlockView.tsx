import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Dices, ExternalLink, GripVertical, Maximize2, Minimize2, Pencil, Plus, Shuffle, Trash2, X } from 'lucide-react'
import { referenceHref } from '@shared/text'
import { parseActions, NEEDS_LABEL } from '@shared/actions'
import { parseDecisions } from '@shared/decisions'
import { showName } from '@shared/ids'
import { openMenu, type MenuItem, type ReorderProps } from '../ui'
import { EntryFace } from '../entries/EntryFace'
import { useEntryPreview } from '../entries/entryPreview'
import { LinkTextarea } from '../data/LinkTextarea'
import { presentOf } from '../../registries/kinds'
import { openSevenLink } from '../../lib/links'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { cn } from '../../lib/cn'
import { closePlay, showPlay } from '../play/playStore'
import { PlayBuilder, type PlayKind } from '../play/PlayBuilder'
import { shapeOf, type Pad, type PadBlock } from './pad'

const TRY = { link: null, agents: [] }

interface Props {
  block: PadBlock
  pad: Pad
  rollable: Set<string>
  drag: ReorderProps
  over: boolean
  wide: boolean | undefined
  onWide: (wide: boolean) => void
  open: boolean
  onOpen: (open: boolean) => void
}

function Clamp({ open, onOpen, children }: { open: boolean; onOpen: (open: boolean) => void; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const [over, setOver] = useState(false)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const check = () => setOver(el.scrollHeight > el.clientHeight + 2)
    const watch = new ResizeObserver(check)
    watch.observe(el)
    if (el.firstElementChild) watch.observe(el.firstElementChild)
    check()
    return () => watch.disconnect()
  }, [open])
  return (
    <>
      <div ref={box} className={open ? undefined : 'pad-clamp'} data-over={over || undefined}>
        {children}
      </div>
      {(over || open) && (
        <button type="button" onClick={() => onOpen(!open)} className="pad-more">
          {open ? 'Show less' : 'Show all'}
        </button>
      )}
    </>
  )
}

function PlayBlock({ tag, title, lines, purple }: { tag: string; title: string; lines: string[]; purple?: boolean }) {
  return (
    <div className={cn('w-full border px-3 py-2', purple ? 'border-purple/50 bg-purple/[0.06]' : 'border-accent/50 bg-accent/[0.05]')}>
      <div className="flex items-center gap-2">
        <span className={cn('border px-1 font-mono text-[9.5px] font-bold', purple ? 'border-purple/50 text-purple' : 'border-accent/60 text-accent')}>{tag}</span>
        <span className="text-[13.5px] font-semibold text-white">{title}</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-1 font-mono text-[10.5px] text-dim">
        {lines.map((l, i) => (
          <span key={i} className="border border-line/50 px-1.5">
            {l}
          </span>
        ))}
      </div>
    </div>
  )
}

function editPlay(pad: Pad, key: string, kind: PlayKind, text: string): void {
  const action = kind === 'action' ? parseActions(text)[0] : undefined
  const decision = kind === 'decision' ? parseDecisions(text)[0] : undefined
  showPlay(`Edit ${kind}`, <PlayBuilder kind={kind} action={action} decision={decision} character={null} where={TRY} keepLabel="Keep on the paper" onKeep={(_k, next) => {
    pad.replace(key, next)
    closePlay()
  }} />)
}

function BlockFrame({ block, pad, drag, over, items, title, wide, badge, children }: { block: PadBlock; pad: Pad; drag: ReorderProps; over: boolean; items: MenuItem[]; title: string; wide: boolean; badge?: string; children: ReactNode }) {
  return (
    <div onDragOver={drag.onDragOver} onDrop={drag.onDrop} onContextMenu={(e) => openMenu(e, title, items)} className={cn('group relative flex items-start gap-1 transition-all', wide ? 'w-full' : 'w-52', over && 'outline outline-1 outline-accent')}>
      <span draggable={drag.draggable} onDragStart={drag.onDragStart} onDragEnd={drag.onDragEnd} title="Drag to reorder" className="mt-1 cursor-grab text-faint opacity-0 transition-opacity hover:text-accent group-hover:opacity-100">
        <GripVertical className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">{children}</div>
      {badge && <span className="pad-badge absolute left-6 top-1 font-mono">{badge}</span>}
      <button type="button" title="Remove from paper" onClick={() => pad.remove(block.key)} className="absolute -right-2 -top-2 z-10 border border-line bg-black/90 p-0.5 text-dim opacity-0 transition-opacity hover:border-alert hover:text-alert group-hover:opacity-100 cursor-pointer">
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}

function LinkBlockView({ block, pad, rollable, drag, over, wide, onWide, open, onOpen, kind, refText, part }: Props & { kind: string; refText: string; part: string | null }) {
  const base = `@${kind}:${refText}`
  const preview = useEntryPreview(base)
  const found = preview && !('missing' in preview) ? preview : null
  const { Chat } = presentOf(found?.kind ?? '')
  const large = Boolean(Chat) && wide === true
  const rolls = rollable.has(kind)
  const rollNow = () =>
    void engine('library.rollText', { text: `${base}#random` })
      .then((r) => pad.replace(block.key, r.text))
      .catch(failed('Could not roll it'))
  const items: MenuItem[] = [
    { label: 'Open', icon: <ExternalLink />, onSelect: () => openSevenLink(referenceHref(kind, refText)) },
    ...(rolls ? [{ label: 'Roll now', icon: <Dices />, onSelect: rollNow }, { label: part === 'random' ? 'Keep as a link' : 'Roll when sent', icon: <Shuffle />, onSelect: () => pad.replace(block.key, part === 'random' ? base : `${base}#random`) }] : []),
    ...(Chat ? [{ label: large ? 'Show as a card' : 'Show large', icon: large ? <Minimize2 /> : <Maximize2 />, onSelect: () => onWide(!large) }] : []),
    { label: 'Add text below', icon: <Plus />, onSelect: () => pad.add([''], block.key) },
    { label: 'Take out', icon: <Trash2 />, danger: true, onSelect: () => pad.remove(block.key) }
  ]
  return (
    <BlockFrame block={block} pad={pad} drag={drag} over={over} items={items} title={showName(refText.replace(/^"|"$/g, ''))} wide={large} badge={part === 'random' ? 'rolls when sent' : undefined}>
      <Clamp open={open} onOpen={onOpen}>
        {large && found && Chat ? <Chat kind={found.kind} id={found.id} part="" /> : <EntryFace link={base} />}
      </Clamp>
      {rolls && (
        <button
          type="button"
          title="Roll this item now"
          onClick={rollNow}
          className="absolute right-6 top-1 z-10 hidden items-center gap-1 border border-accent/60 bg-black/80 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-accent transition-colors hover:bg-accent/20 group-hover:flex cursor-pointer"
        >
          <Dices className="h-3 w-3" />
          <span>Roll</span>
        </button>
      )}
    </BlockFrame>
  )
}

export function PadBlockView(props: Props) {
  const { block, pad } = props
  const shape = shapeOf(block.text)
  if (shape.as === 'link') return <LinkBlockView {...props} kind={shape.kind} refText={shape.ref} part={shape.part} />
  const below: MenuItem = { label: 'Add text below', icon: <Plus />, onSelect: () => pad.add([''], block.key) }
  const take: MenuItem = { label: 'Take out', icon: <Trash2 />, danger: true, onSelect: () => pad.remove(block.key) }
  const items: MenuItem[] = shape.as === 'text' ? [below, take] : [{ label: 'Edit', icon: <Pencil />, onSelect: () => editPlay(pad, block.key, shape.as as PlayKind, block.text) }, below, take]
  let body: ReactNode
  if (shape.as === 'action') {
    const a = parseActions(block.text)[0]
    body = <PlayBlock tag="ACTION" title={a.attempt} lines={[NEEDS_LABEL[a.needs], ...a.checks.map((c) => showName(c.against ?? 'chance'))]} />
  } else if (shape.as === 'decision') {
    const d = parseDecisions(block.text)[0]
    body = <PlayBlock tag="DECISION" purple title={d.question} lines={d.options.map((o) => o.text)} />
  } else {
    body = (
      <div className="flex w-full flex-col border border-line/50 bg-black/40 p-2.5 shadow-sm transition-all hover:border-line">
        <div className="mb-1.5 flex items-center justify-between border-b border-line/25 pb-1 font-mono text-[10px] text-faint uppercase tracking-wider select-none">
          <span className="font-bold text-dim">TEXT NOTE</span>
          <span>{block.text.length} chars</span>
        </div>
        <LinkTextarea
          value={block.text}
          onValue={(text) => pad.replace(block.key, text)}
          rows={Math.max(2, block.text.split('\n').length)}
          placeholder="Write prompt text here… (type @ to reference kinds)"
          className="pad-text w-full resize-none font-mono text-[13.5px] leading-relaxed"
        />
      </div>
    )
  }
  return (
    <BlockFrame block={block} pad={pad} drag={props.drag} over={props.over} items={items} title="On the paper" wide>
      {body}
    </BlockFrame>
  )
}
