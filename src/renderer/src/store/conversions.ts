import { create } from 'zustand'
import type { ConversionChoices, PendingConversion } from '@shared/conversions'
import { engine, main } from '../lib/ipc'
import { errorText } from '../lib/format'
import { allowedRequest } from '../lib/transport'
import { toast } from './toasts'
import { noteFailure } from './problems'

interface ConversionState {
  pending: PendingConversion[]
  choices: ConversionChoices
  dismissed: string[]
  open: boolean
  busy: boolean
  error: string | null
  lastBackupPath: string | null
  refresh: (domain?: string | null, forceOpen?: boolean) => Promise<void>
  setChoice: (conversionId: string, key: string, selected: string[]) => void
  setAllChoices: (conversionId: string, selected: string[]) => void
  dismiss: () => void
  backupAndRun: () => Promise<void>
  runWithoutBackup: () => Promise<void>
}

function defaultBackupName(pending: PendingConversion[]): string {
  const date = new Date().toISOString().slice(0, 10)
  const slug = pending.length === 1 ? pending[0].domain : 'data'
  return `seven-backup-${slug}-${date}.zip`
}

function seedChoices(pending: PendingConversion[], prev: ConversionChoices): ConversionChoices {
  const next: ConversionChoices = {}
  for (const item of pending) {
    if (!item.decisions?.length) continue
    const existing = prev[item.id] ?? {}
    const map: Record<string, string[]> = {}
    for (const d of item.decisions) {
      map[d.key] = existing[d.key] ?? [...d.defaultSelected]
    }
    next[item.id] = map
  }
  return next
}

export const useConversions = create<ConversionState>((set, get) => ({
  pending: [],
  choices: {},
  dismissed: [],
  open: false,
  busy: false,
  error: null,
  lastBackupPath: null,

  refresh: async (domain = null, forceOpen = false) => {
    if (!allowedRequest('main', 'conversions.saveBackup') || !allowedRequest('engine', 'conversions.pending')) {
      return
    }
    try {
      const found = await engine('conversions.pending', domain ? { domain } : undefined)
      const dismissed = new Set(get().dismissed)
      const shouldShow =
        found.length > 0 && (forceOpen || found.some((item) => item.blocking || !dismissed.has(item.id)))
      set((s) => ({
        pending: found,
        choices: seedChoices(found, s.choices),
        open: found.length > 0 ? (shouldShow || s.open) : false,
        error: null
      }))
    } catch (err) {
      noteFailure('conversions', 'Could not check pending data conversions')(err)
    }
  },

  setChoice: (conversionId, key, selected) =>
    set((s) => ({
      choices: {
        ...s.choices,
        [conversionId]: { ...(s.choices[conversionId] ?? {}), [key]: selected }
      }
    })),

  setAllChoices: (conversionId, selected) =>
    set((s) => {
      const item = s.pending.find((p) => p.id === conversionId)
      if (!item?.decisions?.length) return s
      const map: Record<string, string[]> = {}
      for (const d of item.decisions) map[d.key] = [...selected]
      return { choices: { ...s.choices, [conversionId]: map } }
    }),

  dismiss: () => {
    const { pending, busy } = get()
    if (busy || pending.some((p) => p.blocking)) return
    set((s) => ({
      open: false,
      error: null,
      dismissed: [...new Set([...s.dismissed, ...pending.map((p) => p.id)])]
    }))
  },

  backupAndRun: async () => {
    const { pending, choices, busy } = get()
    if (!pending.length || busy) return
    const ids = pending.map((p) => p.id)
    set({ busy: true, error: null })
    try {
      const saved = await main('conversions.saveBackup', {
        ids,
        name: defaultBackupName(pending)
      })
      if (!saved) {
        set({ busy: false })
        return
      }
      set({ lastBackupPath: saved.path })
      const res = await engine('conversions.run', { ids, choices })
      toast.success(
        'Backup saved & data converted',
        res.summary.join(' ') || `Backed up ${saved.files} file(s) and updated data.`
      )
      set({ pending: [], choices: {}, open: false, busy: false, error: null })
    } catch (err) {
      set({ busy: false, error: errorText(err) })
    }
  },

  runWithoutBackup: async () => {
    const { pending, choices, busy } = get()
    if (!pending.length || busy) return
    const ids = pending.map((p) => p.id)
    set({ busy: true, error: null })
    try {
      const res = await engine('conversions.run', { ids, choices })
      toast.success('Data converted', res.summary.join(' ') || 'Updated stored data to the current format.')
      set({ pending: [], choices: {}, open: false, busy: false, error: null })
    } catch (err) {
      set({ busy: false, error: errorText(err) })
    }
  }
}))

export function checkConversions(domain?: string | null, forceOpen = false): void {
  void useConversions.getState().refresh(domain, forceOpen)
}
