import { useEffect, useRef, useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { cn } from '../../lib/cn'
import { errorText } from '../../lib/format'
import { Button } from './Button'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface Saver<T> {
  status: SaveStatus
  error: string | null
  queue: (value: T) => void
  flush: () => Promise<void>
}

export function useAutosave<T>(save: (value: T) => Promise<unknown>, delay = 500): Saver<T> {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const pending = useRef<{ value: T; save: (value: T) => Promise<unknown> } | null>(null)
  const timer = useRef<number | null>(null)
  const saver = useRef(save)
  saver.current = save
  const flush = async () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
    const next = pending.current
    if (!next) return
    pending.current = null
    setStatus('saving')
    try {
      await next.save(next.value)
      setError(null)
      setStatus(pending.current ? 'saving' : 'saved')
    } catch (err) {
      setError(errorText(err))
      setStatus('error')
    }
  }
  const queue = (value: T) => {
    pending.current = { value, save: saver.current }
    setStatus('saving')
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void flush(), delay)
  }
  useEffect(
    () => () => {
      if (pending.current) void flush()
    },
    []
  )
  return { status, error, queue, flush }
}

export interface AutosavedState<T> extends Omit<Saver<T>, 'queue'> {
  value: T
  set: (next: T | ((current: T) => T)) => void
  reset: (value: T) => void
}

export function useAutosavedState<T>(initial: T | (() => T), save: (value: T) => Promise<unknown>, options: { when?: (value: T) => boolean; delay?: number } = {}): AutosavedState<T> {
  const [value, setValue] = useState<T>(initial)
  const auto = useAutosave<T>(save, options.delay)
  const latest = useRef(value)
  latest.current = value
  const set = (next: T | ((current: T) => T)) => {
    const v = typeof next === 'function' ? (next as (current: T) => T)(latest.current) : next
    latest.current = v
    setValue(v)
    if (!options.when || options.when(v)) auto.queue(v)
  }
  const reset = (v: T) => {
    latest.current = v
    setValue(v)
  }
  return { value, set, reset, status: auto.status, error: auto.error, flush: auto.flush }
}

export function useDraft<T>(source: T, save: (value: T) => Promise<unknown>, options: { delay?: number; valid?: (value: T) => boolean } = {}): { draft: T; change: (next: T | ((current: T) => T)) => void; status: SaveStatus; error: string | null; flush: () => Promise<void>; reset: (value: T) => void } {
  const state = useAutosavedState<T>(source, save, { when: options.valid, delay: options.delay })
  const touched = useRef(false)
  const key = JSON.stringify(source)
  useEffect(() => {
    if (!touched.current) state.reset(source)
  }, [key])
  useEffect(() => {
    if (state.status !== 'saving') touched.current = false
  }, [state.status])
  const change = (next: T | ((current: T) => T)) => {
    touched.current = true
    state.set(next)
  }
  const reset = (value: T) => {
    touched.current = false
    state.reset(value)
  }
  return { draft: state.value, change, status: state.status, error: state.error, flush: state.flush, reset }
}

export function SaveState({ status, error, blocked }: { status: SaveStatus; error?: string | null; blocked?: string | null }) {
  if (blocked) return <span title={blocked} className="font-label text-[10.5px] caps-14 text-alert">Not saved until fixed</span>
  if (status === 'idle') return null
  const text = status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : 'Not saved'
  return (
    <span title={status === 'error' && error ? error : undefined} className={cn('flex min-w-0 items-baseline gap-1.5 font-label text-[10.5px] caps-14 ', status === 'error' ? 'text-alert' : status === 'saved' ? 'text-ok' : 'text-dim')}>
      <span className="shrink-0">{text}</span>
      {status === 'error' && error && <span className="max-w-72 truncate normal-case tracking-normal text-[11.5px]">{error}</span>}
    </span>
  )
}

export function MakeOrSaved({ made, saver, what, onMake, disabled = false, size = 'sm' }: { made: boolean; saver: { status: SaveStatus; error: string | null }; what: string; onMake: () => void; disabled?: boolean; size?: 'sm' | 'md' }) {
  if (made) return <SaveState status={saver.status} error={saver.error} />
  return (
    <Button size={size} variant="primary" icon={<Plus />} disabled={disabled} onClick={onMake}>
      Make {what}
    </Button>
  )
}

export function DoneEditing({ saver, onDone, disabled = false, size = 'sm' }: { saver: { status: SaveStatus; error: string | null; flush: () => Promise<void> }; onDone: () => void; disabled?: boolean; size?: 'sm' | 'md' }) {
  return (
    <>
      <SaveState status={saver.status} error={saver.error} />
      <Button size={size} variant="primary" icon={<Check />} disabled={disabled} onClick={() => void saver.flush().then(onDone)}>
        Done
      </Button>
    </>
  )
}
