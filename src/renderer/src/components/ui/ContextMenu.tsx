import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { create } from 'zustand'
import { Button } from './Button'
import { Input } from './inputs'
import { Modal } from './Modal'
import { cn } from '../../lib/cn'
import { useEscapeLayer } from '../../lib/escape'
import { failed } from '../../lib/notify'

export interface MenuItem {
  label: string
  icon?: ReactNode
  onSelect?: () => void
  danger?: boolean
  disabled?: boolean
  separator?: boolean
  children?: MenuItem[]
}

interface MenuSpec {
  id: number
  title: string
  x: number
  y: number
  items: MenuItem[]
}

interface PromptSpec {
  title: string
  label: string
  value: string
  onSubmit: (value: string) => void | Promise<void>
  optional?: boolean
  confirmLabel?: string
}

interface ConfirmSpec {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void | Promise<void>
}

interface MenuState {
  menu: MenuSpec | null
  prompt: PromptSpec | null
  confirm: ConfirmSpec | null
  close: () => void
}

export const useMenu = create<MenuState>((set) => ({
  menu: null,
  prompt: null,
  confirm: null,
  close: () => set({ menu: null })
}))

let menus = 0

export function openMenu(event: { preventDefault(): void; stopPropagation(): void; clientX: number; clientY: number }, title: string, items: MenuItem[]): void {
  event.preventDefault()
  event.stopPropagation()
  const visible = items.filter((i) => i.separator || i.label)
  if (!visible.length) return
  useMenu.setState({ menu: { id: ++menus, title, x: event.clientX, y: event.clientY, items: visible } })
}

export function askText(title: string, label: string, value: string, onSubmit: PromptSpec['onSubmit'], options: { optional?: boolean; confirmLabel?: string } = {}): void {
  useMenu.setState({ prompt: { title, label, value, onSubmit, ...options } })
}

export function askConfirm(title: string, message: string, confirmLabel: string, onConfirm: ConfirmSpec['onConfirm']): void {
  useMenu.setState({ confirm: { title, message, confirmLabel, onConfirm } })
}

export function confirmDelete(title: string, message: string, work: () => Promise<unknown>, after?: () => void, verb = 'Delete'): void {
  askConfirm(title, message, verb, async () => {
    try {
      await work()
      after?.()
    } catch (err) {
      failed(`Could not ${verb.toLowerCase()}`)(err)
    }
  })
}

const SCRAMBLE = '!<>-_\\/[]{}—=+*^?#$%01'

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

function scramble(text: string, reveal: number): string {
  let out = ''
  for (let i = 0; i < text.length; i++) out += i < reveal || text[i] === ' ' ? text[i] : SCRAMBLE[Math.floor(Math.random() * SCRAMBLE.length)]
  return out
}

function useDecrypt(text: string, delay: number, duration = 240): string {
  const [shown, setShown] = useState(() => (reducedMotion() ? text : scramble(text, 0)))
  useEffect(() => {
    if (reducedMotion()) {
      setShown(text)
      return
    }
    let frame = 0
    let start: number | null = null
    const tick = (now: number) => {
      start ??= now
      const p = Math.min(1, (now - start) / duration)
      setShown(scramble(text, Math.floor(p * text.length)))
      if (p < 1) frame = requestAnimationFrame(tick)
      else setShown(text)
    }
    const timer = setTimeout(() => (frame = requestAnimationFrame(tick)), delay)
    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(frame)
    }
  }, [text, delay, duration])
  return shown
}

const PAD = 8

function place(el: HTMLElement, x: number, y: number, flipTo: number | null): { left: number; top: number } {
  const width = el.offsetWidth
  const height = el.offsetHeight
  const left = x + width + PAD > window.innerWidth ? Math.max(PAD, (flipTo ?? x) - width) : x
  const top = y + height + PAD > window.innerHeight ? Math.max(PAD, window.innerHeight - height - PAD) : y
  return { left, top }
}

function Row({ item, index, onDone, onHover, open }: { item: MenuItem; index: number; onDone: () => void; onHover: (el: HTMLElement | null) => void; open: boolean }) {
  const label = useDecrypt(item.label, index * 40)
  const [hovered, setHovered] = useState(false)
  if (item.separator) return <div className="my-1 h-px bg-line/50" />
  return (
    <button
      type="button"
      disabled={item.disabled}
      onMouseEnter={(e) => {
        setHovered(true)
        onHover(item.children ? e.currentTarget : null)
      }}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => {
        if (item.children) {
          onHover(e.currentTarget)
          return
        }
        onDone()
        item.onSelect?.()
      }}
      style={{ animation: `seven-menu-row 170ms ease-out ${index * 40}ms both` }}
      className={cn(
        'relative flex w-full items-center gap-2 overflow-hidden px-3 py-1.5 text-left font-mono text-[12px] transition-colors disabled:opacity-40',
        item.danger ? 'text-alert hover:text-white' : 'text-accent hover:text-white',
        open && 'text-white'
      )}
    >
      {(hovered || open) && <span className="pointer-events-none absolute inset-0 bg-accent/15" style={{ animation: 'seven-menu-scan 450ms linear' }} />}
      <span className="relative w-3 text-[10px] opacity-70">{hovered || open ? '›' : '·'}</span>
      {item.icon && <span className="relative flex h-3.5 w-3.5 items-center [&>svg]:h-3.5 [&>svg]:w-3.5">{item.icon}</span>}
      <span className="relative min-w-0 flex-1 truncate">{label}</span>
      {item.children && <ChevronRight className="relative h-3.5 w-3.5 opacity-70" />}
    </button>
  )
}

function columnRows(panel: HTMLElement, body: HTMLElement): number | null {
  const room = window.innerHeight - PAD * 2 - (panel.offsetHeight - body.offsetHeight)
  if (body.offsetHeight <= room) return null
  const row = Math.max(1, ...Array.from(body.children).map((c) => (c as HTMLElement).offsetHeight))
  return Math.max(1, Math.floor(room / row))
}

function Panel({ title, items, x, y, flipTo = null, onDone, depth }: { title?: string; items: MenuItem[]; x: number; y: number; flipTo?: number | null; onDone: () => void; depth: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const [rows, setRows] = useState<number | null | undefined>(undefined)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const [sub, setSub] = useState<{ index: number; x: number; y: number; flipTo: number } | null>(null)
  const heading = useDecrypt(title ?? '', 0, 220)
  useLayoutEffect(() => {
    if (ref.current && body.current) setRows(columnRows(ref.current, body.current))
  }, [items])
  useLayoutEffect(() => {
    if (ref.current && rows !== undefined) setPos(place(ref.current, x, y, flipTo))
  }, [x, y, flipTo, rows])
  return (
    <>
      <div
        ref={ref}
        data-seven-menu
        onMouseDown={(e) => e.stopPropagation()}
        style={{ left: pos?.left ?? x, top: pos?.top ?? y, visibility: pos ? 'visible' : 'hidden', zIndex: 10000 + depth, animation: 'seven-menu-in 150ms ease-out' }}
        className={cn('fixed flex min-w-52 flex-col border border-line border-l-2 border-l-accent bg-sidebar/95 py-1 shadow-[0_12px_30px_rgba(0,0,0,0.85)] backdrop-blur-sm', !rows && 'max-w-80')}
      >
        {title && (
          <div className="mb-1 flex items-center border-b border-line/60 px-3 py-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-accent-soft">
            <span className="truncate">{heading}</span>
            <span className="ml-0.5 inline-block h-[11px] w-[6px] bg-accent-soft" style={{ animation: 'seven-menu-cursor 1s steps(1) infinite' }} />
          </div>
        )}
        <div ref={body} className={rows ? 'grid' : 'flex flex-col'} style={rows ? { gridTemplateRows: `repeat(${rows}, auto)`, gridAutoFlow: 'column', gridAutoColumns: 'minmax(13rem, max-content)' } : undefined}>
          {items.map((item, i) => (
            <Row
              key={`${i}-${item.label}`}
              item={item}
              index={i}
              open={sub?.index === i}
              onDone={onDone}
              onHover={(el) => {
                if (!el || !pos) return setSub(null)
                setSub({ index: i, x: pos.left + el.offsetLeft + el.offsetWidth + 2, y: pos.top + el.offsetTop - 4, flipTo: pos.left + el.offsetLeft - 2 })
              }}
            />
          ))}
        </div>
      </div>
      {sub && items[sub.index]?.children && <Panel key={sub.index} items={items[sub.index].children!} x={sub.x} y={sub.y} flipTo={sub.flipTo} onDone={onDone} depth={depth + 1} />}
    </>
  )
}

function PromptDialog() {
  const prompt = useMenu((s) => s.prompt)
  const [value, setValue] = useState('')
  useEffect(() => setValue(prompt?.value ?? ''), [prompt])
  if (!prompt) return null
  const close = () => useMenu.setState({ prompt: null })
  const submit = async () => {
    if (!value.trim() && !prompt.optional) return
    await prompt.onSubmit(value.trim())
    close()
  }
  return (
    <Modal
      open
      title={prompt.title}
      onClose={close}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!value.trim() && !prompt.optional} onClick={() => void submit()}>
            {prompt.confirmLabel ?? 'Save'}
          </Button>
        </>
      }
    >
      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-accent-soft">{prompt.label}</span>
        <Input autoFocus value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void submit()} />
      </label>
    </Modal>
  )
}

function ConfirmDialog() {
  const confirm = useMenu((s) => s.confirm)
  if (!confirm) return null
  const close = () => useMenu.setState({ confirm: null })
  return (
    <Modal
      open
      title={confirm.title}
      onClose={close}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              close()
              void confirm.onConfirm()
            }}
          >
            {confirm.confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-[13px] text-white/90">{confirm.message}</p>
    </Modal>
  )
}

export function ContextMenuHost() {
  const menu = useMenu((s) => s.menu)
  const close = useMenu((s) => s.close)
  useEffect(() => {
    if (!menu) return
    const down = (e: MouseEvent) => {
      if (!(e.target as HTMLElement | null)?.closest('[data-seven-menu]')) close()
    }
    const blur = () => close()
    document.addEventListener('mousedown', down)
    window.addEventListener('blur', blur)
    window.addEventListener('resize', blur)
    return () => {
      document.removeEventListener('mousedown', down)
      window.removeEventListener('blur', blur)
      window.removeEventListener('resize', blur)
    }
  }, [menu, close])
  useEscapeLayer(Boolean(menu), close)
  return (
    <>
      <style>{`
        @keyframes seven-menu-in { from { transform: scaleY(0.6); opacity: 0 } to { transform: scaleY(1); opacity: 1 } }
        @keyframes seven-menu-row { from { opacity: 0; transform: translateX(-4px) } to { opacity: 1; transform: translateX(0) } }
        @keyframes seven-menu-scan { from { opacity: 0.6 } to { opacity: 0.25 } }
        @keyframes seven-menu-cursor { 0%, 49% { opacity: 1 } 50%, 100% { opacity: 0 } }
        @media (prefers-reduced-motion: reduce) { [data-seven-menu], [data-seven-menu] * { animation: none !important } }
      `}</style>
      {menu && <Panel key={menu.id} title={menu.title} items={menu.items} x={menu.x} y={menu.y} onDone={close} depth={0} />}
      <PromptDialog />
      <ConfirmDialog />
    </>
  )
}
