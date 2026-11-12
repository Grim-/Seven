import { useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '../../lib/cn'
import { useToasts, type ToastKind } from '../../store/toasts'
import { dismissUpload, useUploads } from '../../lib/uploads'
import { Meter } from './Meter'
import { DecodeText } from './DecodeText'
import { hideTip, showTip } from './TooltipHost'

export type Tone = 'ok' | 'busy' | 'warn' | 'error' | 'idle'

const toneClass: Record<Tone, string> = {
  ok: 'text-ok border-ok/40 bg-ok/5',
  busy: 'text-cyan border-cyan/40 bg-cyan/5',
  warn: 'text-accent border-line bg-accent/5',
  error: 'text-alert border-alert/50 bg-alert/5',
  idle: 'text-dim border-faint bg-black/40'
}

const dotClass: Record<Tone, string> = {
  ok: 'bg-ok shadow-[0_0_6px_var(--color-ok)]',
  busy: 'bg-cyan animate-pulse shadow-[0_0_6px_var(--color-cyan)]',
  warn: 'bg-accent',
  error: 'bg-alert shadow-[0_0_6px_var(--color-alert)]',
  idle: 'bg-faint'
}

export function StatusBadge({ tone, children, className, title }: { tone: Tone; children: ReactNode; className?: string; title?: string }) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex h-6 max-w-full items-center gap-1.5 border px-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.1em]',
        toneClass[tone],
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0', dotClass[tone])} />
      <span className="truncate">{children}</span>
    </span>
  )
}

export function AlertBox({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('whitespace-pre-wrap border border-alert/50 bg-alert/5 px-3 py-2 text-[12.5px] text-alert', className)}>{children}</div>
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex h-full min-h-40 items-center justify-center p-6">
      <div className="empty-slate flex max-w-md flex-col items-center gap-2.5 px-8 py-6 text-center">
        <div className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-accent-soft">{title}</div>
        {children && <div className="text-[13px] leading-relaxed text-dim">{children}</div>}
        {action}
      </div>
    </div>
  )
}

export function Tooltip({ title, body, children, side = 'top' }: { title: string; body?: ReactNode; children: ReactNode; side?: 'top' | 'bottom' }) {
  const ref = useRef<HTMLSpanElement>(null)
  return (
    <span ref={ref} className="inline-flex" onMouseEnter={() => ref.current && showTip(ref.current, title, body, side)} onMouseLeave={() => hideTip('component')}>
      {children}
    </span>
  )
}

const toastBar: Record<ToastKind, string> = {
  info: 'border-l-cyan',
  success: 'border-l-ok',
  error: 'border-l-alert'
}

export function Toaster({ placement = 'app' }: { placement?: 'app' | 'overlay' }) {
  const { toasts, dismiss } = useToasts()
  const uploads = useUploads((s) => s.uploads)
  return (
    <div
      className={cn(
        'pointer-events-none fixed z-[300] flex flex-col gap-2',
        placement === 'app' ? 'bottom-20 right-4 w-80' : 'inset-x-3 top-12'
      )}
    >
      <AnimatePresence initial={false}>
      {uploads.map((u) => (
        <motion.div
          key={`upload-${u.id}`}
          layout
          className={cn('record pointer-events-auto', u.error ? 'border-l-alert' : 'border-l-cyan')}
          initial={{ opacity: 0, x: placement === 'app' ? 48 : 0, y: placement === 'app' ? 0 : -16 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, x: placement === 'app' ? 48 : 0, y: placement === 'app' ? 0 : -16, transition: { duration: 0.15 } }}
          transition={{ type: 'spring', stiffness: 480, damping: 36 }}
        >
          <div className="record-header flex items-center justify-between gap-2">
            <DecodeText className="truncate" text={u.error ? 'Could not send the file' : 'Sending to Seven'} />
            {u.error && (
              <button className="text-dim hover:text-white" onClick={() => dismissUpload(u.id)}>
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="relative z-[2] px-3 py-2">
            {u.error ? (
              <div className="text-[12px] leading-relaxed text-white">{u.error}</div>
            ) : (
              <Meter label={u.name} value={u.sent / u.size} text={`${Math.round((u.sent / u.size) * 100)}%`} />
            )}
          </div>
        </motion.div>
      ))}
      {toasts.map((t) => (
        <motion.div
          key={t.id}
          layout
          className={cn('record pointer-events-auto', toastBar[t.kind])}
          initial={{ opacity: 0, x: placement === 'app' ? 48 : 0, y: placement === 'app' ? 0 : -16 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, x: placement === 'app' ? 48 : 0, y: placement === 'app' ? 0 : -16, transition: { duration: 0.15 } }}
          transition={{ type: 'spring', stiffness: 480, damping: 36 }}
        >
          <div className="record-header flex items-center justify-between gap-2">
            <DecodeText className="truncate" text={t.title} />
            <button className="text-dim hover:text-white" onClick={() => dismiss(t.id)}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {t.message && <div className="relative z-[2] px-3 py-2 text-[12px] leading-relaxed text-white">{t.message}</div>}
          {t.action && (
            <div className="relative z-[2] flex justify-end px-3 pb-2">
              <button
                type="button"
                onClick={() => {
                  t.action?.onSelect()
                  dismiss(t.id)
                }}
                className="border border-accent/60 px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-accent hover:bg-accent/10 hover:text-white"
              >
                {t.action.label}
              </button>
            </div>
          )}
        </motion.div>
      ))}
      </AnimatePresence>
    </div>
  )
}

export function ViewHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex shrink-0 items-end justify-between gap-4 border-b border-line/50 pb-3 tablet:flex-wrap tablet:items-center tablet:gap-2 phone:pb-2">
      <div>
        <h1 className="font-mono text-[22px] font-bold uppercase tracking-[0.12em] text-white phone:text-[17px]">{title}</h1>
        {subtitle && <p className="mt-1 text-[13px] text-dim phone:text-[12px]">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 tablet:flex-wrap">{actions}</div>}
    </div>
  )
}
