import { useEffect, useMemo, useState } from 'react'
import { create } from 'zustand'
import { ArrowRightLeft, Check, Copy, Loader2 } from 'lucide-react'
import { showName } from '@shared/ids'
import type { WorldTransferCategory, WorldTransferItem } from '@shared/portability'
import { cn } from '../../lib/cn'
import { engine } from '../../lib/ipc'
import { openEntry } from '../../lib/library'
import { failed } from '../../lib/notify'
import { toast } from '../../store/toasts'
import { AlertBox, Button, Modal, SearchBox, Select, Toggle } from '../ui'
import { useWorlds } from './useWorlds'

type TransferModalState =
  | {
      mode: 'push'
      entries: { ref: string; title: string }[]
      sourceWorld: string | null
    }
  | {
      mode: 'pull'
      targetWorld: string
      initialCategory: WorldTransferCategory | 'all'
    }

const useWorldTransfer = create<{
  active: TransferModalState | null
  open: (next: TransferModalState) => void
  close: () => void
}>((set) => ({
  active: null,
  open: (active) => set({ active }),
  close: () => set({ active: null })
}))

export function openCopyToWorld(opts: { entries: { ref: string; title: string }[]; sourceWorld?: string | null }): void {
  if (!opts.entries.length) return
  const inferred = opts.sourceWorld ?? (opts.entries[0].ref.split('/')[0] || null)
  useWorldTransfer.getState().open({ mode: 'push', entries: opts.entries, sourceWorld: inferred })
}

export function openBringFromWorld(opts: { targetWorld: string; initialCategory?: WorldTransferCategory | 'all' }): void {
  useWorldTransfer.getState().open({
    mode: 'pull',
    targetWorld: opts.targetWorld,
    initialCategory: opts.initialCategory ?? 'all'
  })
}

const CATEGORY_LABELS: Record<WorldTransferCategory, string> = {
  faction: 'Factions',
  region: 'Regions',
  place: 'Places',
  knowledge: 'Lore',
  event: 'Events',
  npc: 'Cast & NPCs',
  record: 'Custom Records'
}

const CATEGORY_ORDER: WorldTransferCategory[] = ['faction', 'region', 'place', 'knowledge', 'event', 'npc', 'record']

function PushToWorldModal({
  entries,
  sourceWorld,
  onClose
}: {
  entries: { ref: string; title: string }[]
  sourceWorld: string | null
  onClose: () => void
}) {
  const worlds = useWorlds()
  const otherWorlds = useMemo(() => worlds.filter((w) => w.id !== sourceWorld), [worlds, sourceWorld])
  const [targetWorld, setTargetWorld] = useState<string>(() => otherWorlds[0]?.id ?? worlds[0]?.id ?? '')
  const [replace, setReplace] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!targetWorld && (otherWorlds[0] || worlds[0])) {
      setTargetWorld(otherWorlds[0]?.id ?? worlds[0]?.id ?? '')
    }
  }, [otherWorlds, targetWorld, worlds])

  const targetName = worlds.find((w) => w.id === targetWorld)?.name ?? targetWorld

  const submit = async () => {
    if (!targetWorld || busy) return
    setBusy(true)
    try {
      const res = await engine('worlds.copyItems', {
        entries: entries.map((e) => e.ref),
        targetWorld,
        replace
      })
      if (res.copied.length === 1) {
        const one = res.copied[0]
        toast.success(`Copied ${showName(one.title)}`, `Into ${targetName}`, {
          label: 'Open',
          onSelect: () => openEntry('world', one.ref)
        })
      } else if (res.copied.length > 1) {
        toast.success(`Copied ${res.copied.length} items`, `Into ${targetName}`, {
          label: 'Open world',
          onSelect: () => openEntry('world', targetWorld)
        })
      } else {
        toast.info('Nothing copied', res.skipped[0]?.reason)
      }
      onClose()
    } catch (err) {
      failed('Could not copy to world')(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      width={500}
      title={entries.length === 1 ? `Copy "${showName(entries[0].title)}" to another world` : `Copy ${entries.length} items to another world`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon={busy ? <Loader2 className="animate-spin" /> : <Copy />}
            disabled={!targetWorld || busy}
            onClick={() => void submit()}
          >
            {targetName ? `Copy to ${targetName}` : 'Copy'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1 border border-line/60 tone-panel-40 p-2.5">
          <div className="font-label text-[10px] font-bold caps-16 text-accent-soft">Items to copy</div>
          <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto pt-1">
            {entries.map((e) => (
              <span key={e.ref} className="border border-line/60 tone-well-50 px-2 py-0.5 text-[12px] text-ink">
                {showName(e.title)}
              </span>
            ))}
          </div>
        </div>

        {worlds.length === 0 ? (
          <AlertBox>Create a world first before copying items into it.</AlertBox>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label className="font-label text-[10.5px] font-bold caps-16 text-accent-soft">Destination world</label>
            <Select
              value={targetWorld}
              onChange={setTargetWorld}
              options={worlds.map((w) => ({
                value: w.id,
                label: w.id === sourceWorld ? `${w.name} (same world — duplicate)` : w.name
              }))}
            />
            {otherWorlds.length === 0 && (
              <p className="text-[11.5px] text-dim">
                You only have one world right now. Create another world in Worlds to copy items across worlds, or duplicate into this world.
              </p>
            )}
          </div>
        )}

        <Toggle
          checked={replace}
          onChange={setReplace}
          label="Overwrite matching items in destination world"
        />
        <p className="text-[11.5px] text-dim">
          Copying a region automatically includes its subregions and places; copying a place includes nested child places.
        </p>
      </div>
    </Modal>
  )
}

function PullFromWorldModal({
  targetWorld,
  initialCategory,
  onClose
}: {
  targetWorld: string
  initialCategory: WorldTransferCategory | 'all'
  onClose: () => void
}) {
  const worlds = useWorlds()
  const targetMeta = worlds.find((w) => w.id === targetWorld)
  const sourceWorlds = useMemo(() => worlds.filter((w) => w.id !== targetWorld), [worlds, targetWorld])
  const [sourceWorld, setSourceWorld] = useState<string>(() => sourceWorlds[0]?.id ?? '')
  const [items, setItems] = useState<WorldTransferItem[]>([])
  const [loading, setLoading] = useState(false)
  const [category, setCategory] = useState<WorldTransferCategory | 'all'>(initialCategory)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [replace, setReplace] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!sourceWorld && sourceWorlds[0]) setSourceWorld(sourceWorlds[0].id)
  }, [sourceWorld, sourceWorlds])

  useEffect(() => {
    if (!sourceWorld) {
      setItems([])
      return
    }
    let live = true
    setLoading(true)
    setSelected(new Set())
    void engine('worlds.listTransferables', { world: sourceWorld })
      .then((list) => {
        if (live) setItems(list)
      })
      .catch(failed('Could not list world items'))
      .finally(() => {
        if (live) setLoading(false)
      })
    return () => {
      live = false
    }
  }, [sourceWorld])

  const counts = useMemo(() => {
    const map: Partial<Record<WorldTransferCategory, number>> = {}
    for (const item of items) map[item.category] = (map[item.category] ?? 0) + 1
    return map
  }, [items])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((it) => {
      if (category !== 'all' && it.category !== category) return false
      if (!q) return true
      return (
        it.title.toLowerCase().includes(q) ||
        it.subtitle.toLowerCase().includes(q) ||
        it.groupLabel.toLowerCase().includes(q)
      )
    })
  }, [category, items, query])

  const toggle = (ref: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(ref)) next.delete(ref)
      else next.add(ref)
      return next
    })
  }

  const selectAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const it of visible) next.add(it.ref)
      return next
    })
  }

  const clearSelection = () => setSelected(new Set())

  const submit = async () => {
    if (!selected.size || busy) return
    setBusy(true)
    try {
      const res = await engine('worlds.copyItems', {
        entries: [...selected],
        targetWorld,
        replace
      })
      if (res.copied.length > 0) {
        toast.success(
          `Copied ${res.copied.length} ${res.copied.length === 1 ? 'item' : 'items'}`,
          `Added to ${targetMeta?.name ?? targetWorld}${res.skipped.length ? ` · ${res.skipped.length} skipped` : ''}`
        )
      } else {
        toast.info('Nothing copied', res.skipped[0]?.reason)
      }
      onClose()
    } catch (err) {
      failed('Could not copy world items')(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      width={680}
      title={`Bring items into ${targetMeta?.name ?? targetWorld}`}
      onClose={onClose}
      footer={
        <>
          <span className="mr-auto font-label text-[10.5px] caps-14 text-faint">
            {selected.size > 0 ? `${selected.size} selected` : 'Pick factions, places, regions, lore, events, NPCs, or records'}
          </span>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon={busy ? <Loader2 className="animate-spin" /> : <ArrowRightLeft />}
            disabled={selected.size === 0 || busy}
            onClick={() => void submit()}
          >
            {selected.size > 0 ? `Copy ${selected.size} ${selected.size === 1 ? 'item' : 'items'}` : 'Copy'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {sourceWorlds.length === 0 ? (
          <AlertBox>There are no other worlds to copy from yet. Create another world first or import a `.sevenpack` bundle.</AlertBox>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-2.5">
              <div className="flex min-w-[200px] flex-1 flex-col gap-1">
                <label className="font-label text-[10px] font-bold caps-16 text-accent-soft">Source world</label>
                <Select
                  value={sourceWorld}
                  onChange={setSourceWorld}
                  options={sourceWorlds.map((w) => ({ value: w.id, label: w.name }))}
                />
              </div>
              <SearchBox value={query} onChange={setQuery} placeholder="Filter by name…" className="w-56" />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCategory('all')}
                className={cn(
                  'cursor-pointer border px-2 py-0.5 font-label text-[10px] font-bold caps-10 transition-colors',
                  category === 'all'
                    ? 'border-accent bg-accent/15 text-accent'
                    : 'border-line/50 tone-well-50 text-dim hover:border-line hover:text-ink'
                )}
              >
                All ({items.length})
              </button>
              {CATEGORY_ORDER.filter((cat) => (counts[cat] ?? 0) > 0 || category === cat).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={cn(
                    'cursor-pointer border px-2 py-0.5 font-label text-[10px] font-bold caps-10 transition-colors',
                    category === cat
                      ? 'border-accent bg-accent/15 text-accent'
                      : 'border-line/50 tone-well-50 text-dim hover:border-line hover:text-ink'
                  )}
                >
                  {CATEGORY_LABELS[cat]} ({counts[cat] ?? 0})
                </button>
              ))}
              <div className="ml-auto flex items-center gap-1.5">
                {visible.length > 0 && (
                  <Button size="sm" variant="ghost" onClick={selectAllVisible}>
                    Select shown
                  </Button>
                )}
                {selected.size > 0 && (
                  <Button size="sm" variant="ghost" onClick={clearSelection}>
                    Clear
                  </Button>
                )}
              </div>
            </div>

            <div className="max-h-72 min-h-[160px] overflow-y-auto border border-line/60 tone-panel-30 divide-y divide-line/25">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-[12px] text-dim">
                  <Loader2 className="h-4 w-4 animate-spin text-accent" />
                  Loading world contents…
                </div>
              ) : visible.length === 0 ? (
                <div className="py-10 text-center text-[12px] text-faint">
                  {items.length === 0 ? 'This world has no transferable items yet.' : 'Nothing matches this filter.'}
                </div>
              ) : (
                visible.map((item) => {
                  const checked = selected.has(item.ref)
                  return (
                    <button
                      key={item.ref}
                      type="button"
                      onClick={() => toggle(item.ref)}
                      className={cn(
                        'flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left transition-colors',
                        checked ? 'bg-accent/10' : 'hover:bg-accent/[0.04]'
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center border',
                          checked ? 'border-accent bg-accent text-on-accent' : 'border-line/70 tone-well-50'
                        )}
                      >
                        {checked && <Check className="h-3 w-3" />}
                      </span>
                      <span className="shrink-0 border border-line/50 tone-well-50 px-1.5 py-px font-label text-[9.5px] font-bold caps text-accent-soft">
                        {item.groupLabel}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{showName(item.title)}</span>
                      <span className="max-w-[180px] truncate text-[11px] text-dim">{item.subtitle}</span>
                    </button>
                  )
                })
              )}
            </div>

            <Toggle
              checked={replace}
              onChange={setReplace}
              label="Overwrite matching items in destination world"
            />
            <p className="text-[11.5px] text-dim">
              Selecting a region automatically copies its subregions and places; selecting a place copies nested child places.
            </p>
          </>
        )}
      </div>
    </Modal>
  )
}

export function WorldTransferHost() {
  const active = useWorldTransfer((s) => s.active)
  const close = useWorldTransfer((s) => s.close)
  if (!active) return null
  if (active.mode === 'push') {
    return <PushToWorldModal entries={active.entries} sourceWorld={active.sourceWorld} onClose={close} />
  }
  return <PullFromWorldModal targetWorld={active.targetWorld} initialCategory={active.initialCategory} onClose={close} />
}
