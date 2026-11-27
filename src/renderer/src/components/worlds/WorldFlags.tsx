import { useState, useMemo } from 'react'
import { Bookmark, Flag, Plus, Trash2, ToggleLeft, ToggleRight, Layers, Zap } from 'lucide-react'
import type { WorldMeta } from '@shared/world'
import { Button, EmptyState, Input, SearchBox, Select, confirmDelete } from '../ui'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { toast } from '../../store/toasts'
import { cn } from '../../lib/cn'

interface Props {
  world: WorldMeta
}

type FlagType = 'boolean' | 'number' | 'string'

export function WorldFlags({ world }: Props) {
  const flags = useLive(() => engine('worlds.flags', { id: world.id }), 'worlds.changed') ?? {}
  const uses = useLive(() => engine('worlds.maps', { id: world.id }), 'worlds.changed') ?? []

  const [search, setSearch] = useState('')
  const [newKey, setNewKey] = useState('')
  const [newType, setNewType] = useState<FlagType>('boolean')
  const [newVal, setNewVal] = useState('true')

  // Scan triggers and layer gating across all map uses in this world to find flag usages
  const usageMap = useMemo(() => {
    const usages: Record<string, { triggers: { map: string; name: string; role: 'needs' | 'sets' | 'hides' }[]; layers: { map: string; id: string; role: 'needs' | 'hides' }[] }> = {}

    const ensure = (key: string) => {
      if (!usages[key]) usages[key] = { triggers: [], layers: [] }
      return usages[key]
    }

    for (const u of uses) {
      for (const t of u.triggers ?? []) {
        if (t.needsFlag) ensure(t.needsFlag).triggers.push({ map: u.map, name: t.name, role: 'needs' })
        if (t.hiddenIfFlag) ensure(t.hiddenIfFlag).triggers.push({ map: u.map, name: t.name, role: 'hides' })
        if (t.setsFlag) ensure(t.setsFlag).triggers.push({ map: u.map, name: t.name, role: 'sets' })
      }
      for (const [layerId, gating] of Object.entries(u.layerGating ?? {})) {
        if (gating.needsFlag) ensure(gating.needsFlag).layers.push({ map: u.map, id: layerId, role: 'needs' })
        if (gating.hiddenIfFlag) ensure(gating.hiddenIfFlag).layers.push({ map: u.map, id: layerId, role: 'hides' })
      }
    }
    return usages
  }, [uses])

  // Combine flags that are set with flags that are referenced by triggers/layers
  const allKnownKeys = useMemo(() => {
    const set = new Set([...Object.keys(flags), ...Object.keys(usageMap)])
    return [...set].sort()
  }, [flags, usageMap])

  const filteredKeys = allKnownKeys.filter((k) =>
    k.toLowerCase().includes(search.trim().toLowerCase())
  )

  const handleSetFlag = async (key: string, value: string | number | boolean | null) => {
    try {
      await engine('worlds.setFlag', { id: world.id, key, value })
      if (value === null) {
        toast.info('Flag Cleared', `Flag "${key}" was removed.`)
      } else {
        toast.success('Flag Updated', `${key} = ${String(value)}`)
      }
    } catch (err) {
      toast.error('Failed to update flag', String(err))
    }
  }

  const handleAddFlag = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanKey = newKey.trim().toLowerCase().replace(/\s+/g, '_')
    if (!cleanKey) return

    let parsedVal: string | number | boolean = true
    if (newType === 'boolean') {
      parsedVal = newVal === 'true'
    } else if (newType === 'number') {
      parsedVal = Number(newVal) || 0
    } else {
      parsedVal = newVal
    }

    await handleSetFlag(cleanKey, parsedVal)
    setNewKey('')
    setNewVal('true')
  }

  const handleDelete = (key: string) => {
    confirmDelete(
      `Clear flag "${key}"?`,
      'This flag will be unset from the world instance. Triggers or layers requiring it will evaluate as false.',
      () => handleSetFlag(key, null)
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 font-ui select-none">
      {/* HEADER BAR */}
      <div className="flex items-center justify-between border-b border-line pb-2.5">
        <div className="flex items-center gap-2">
          <Bookmark className="h-4 w-4 text-secondary-ink" />
          <span className="text-[12px] font-bold caps-5 text-ink">
            WORLD INSTANCE FLAGS &amp; GATING STATE
          </span>
          <span className="text-[11px] text-dim">
            ({Object.keys(flags).length} active flag{Object.keys(flags).length === 1 ? '' : 's'} set)
          </span>
        </div>

        <div className="w-56">
          <SearchBox value={search} onChange={setSearch} placeholder="Filter flags…" />
        </div>
      </div>

      {/* CREATE FLAG FORM */}
      <form
        onSubmit={handleAddFlag}
        className="flex flex-wrap items-end gap-2.5 border border-line/60 tone-panel-40 p-3"
      >
        <div className="flex-1 min-w-[200px]">
          <span className="mb-1 block text-[10px] caps-5 text-faint">
            New Flag Key
          </span>
          <Input
            value={newKey}
            placeholder="e.g. bridge_repaired, crypt_unsealed, boss_defeated"
            onChange={(e) => setNewKey(e.target.value)}
            className="h-7 text-[12px]"
          />
        </div>

        <div className="w-32">
          <span className="mb-1 block text-[10px] caps-5 text-faint">
            Type
          </span>
          <Select
            value={newType}
            options={[
              { value: 'boolean', label: 'Boolean' },
              { value: 'number', label: 'Number' },
              { value: 'string', label: 'String' }
            ]}
            onChange={(t) => {
              setNewType(t as FlagType)
              if (t === 'boolean') setNewVal('true')
              else if (t === 'number') setNewVal('0')
              else setNewVal('')
            }}
            className="h-7 text-[12px]"
          />
        </div>

        <div className="w-36">
          <span className="mb-1 block text-[10px] caps-5 text-faint">
            Initial Value
          </span>
          {newType === 'boolean' ? (
            <Select
              value={newVal}
              options={[
                { value: 'true', label: 'True' },
                { value: 'false', label: 'False' }
              ]}
              onChange={setNewVal}
              className="h-7 text-[12px]"
            />
          ) : (
            <Input
              value={newVal}
              type={newType === 'number' ? 'number' : 'text'}
              onChange={(e) => setNewVal(e.target.value)}
              className="h-7 text-[12px]"
            />
          )}
        </div>

        <Button
          type="submit"
          size="sm"
          variant="primary"
          icon={<Plus className="h-3.5 w-3.5" />}
          disabled={!newKey.trim()}
        >
          Add Flag
        </Button>
      </form>

      {/* FLAGS LIST / TABLE */}
      {filteredKeys.length === 0 ? (
        <EmptyState title="No flags set">
          Flags control quest state, puzzle progress, and layer/interaction visibility. Add a flag above or set one via triggers.
        </EmptyState>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
          <div className="grid grid-cols-[1fr_180px_1fr_60px] gap-2 border-b border-line/60 pb-1.5 font-label text-[10px] font-bold caps-5 text-dim">
            <span>Flag Key</span>
            <span>Current Value</span>
            <span>Gating References</span>
            <span className="text-right">Action</span>
          </div>

          <div className="flex flex-col divide-y divide-line/20">
            {filteredKeys.map((key) => {
              const val = flags[key]
              const isSet = val !== undefined
              const isBool = typeof val === 'boolean' || val === undefined
              const usage = usageMap[key]

              return (
                <div
                  key={key}
                  className="grid grid-cols-[1fr_180px_1fr_60px] items-center gap-2 py-2.5 transition-colors hover:bg-ink/[0.02]"
                >
                  {/* FLAG KEY */}
                  <div className="flex items-center gap-2">
                    <Flag className={cn('h-3.5 w-3.5', isSet && val ? 'text-secondary-ink' : 'text-faint')} />
                    <span className="font-bold text-ink text-[12.5px]">{key}</span>
                    {!isSet && (
                      <span className="border border-line/40 px-1 font-label text-[9px] caps text-dim">
                        Unset (Evaluates False)
                      </span>
                    )}
                  </div>

                  {/* VALUE / TOGGLE */}
                  <div className="flex items-center gap-2">
                    {isBool ? (
                      <button
                        type="button"
                        onClick={() => handleSetFlag(key, !val)}
                        className={cn(
                          'flex items-center gap-1.5 border px-2.5 py-0.5 text-[11px] font-bold caps transition-all',
                          val
                            ? 'border-ok/40 bg-ok/10 text-ok'
                            : 'border-line/40 tone-well-40 text-faint hover:text-ink'
                        )}
                      >
                        {val ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                        {val ? 'TRUE' : 'FALSE'}
                      </button>
                    ) : (
                      <input
                        type={typeof val === 'number' ? 'number' : 'text'}
                        defaultValue={String(val)}
                        onBlur={(e) => {
                          const v = typeof val === 'number' ? Number(e.target.value) || 0 : e.target.value
                          if (v !== val) handleSetFlag(key, v)
                        }}
                        className="h-6 w-32 border border-line tone-well-60 px-2 font-ui text-[11px] text-ink focus:border-secondary-ink focus:outline-none"
                      />
                    )}
                  </div>

                  {/* REFERENCES */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[10.5px]">
                    {usage?.triggers.map((t, idx) => (
                      <span
                        key={idx}
                        className={cn(
                          'flex items-center gap-1 border px-1.5 py-0.2',
                          t.role === 'sets'
                            ? 'border-accent/40 bg-accent/10 text-accent'
                            : t.role === 'hides'
                              ? 'border-alert/40 bg-alert/10 text-alert'
                              : 'border-secondary-ink/40 bg-secondary-ink/10 text-secondary-ink'
                        )}
                        title={`Map: ${t.map}`}
                      >
                        <Zap className="h-2.5 w-2.5" />
                        {t.role === 'sets' ? 'Sets: ' : t.role === 'hides' ? 'Hides: ' : 'Needs: '}
                        {t.name}
                      </span>
                    ))}
                    {usage?.layers.map((l, idx) => (
                      <span
                        key={idx}
                        className={cn(
                          'flex items-center gap-1 border px-1.5 py-0.2',
                          l.role === 'hides'
                            ? 'border-alert/40 bg-alert/10 text-alert'
                            : 'border-secondary-ink/40 bg-secondary-ink/10 text-secondary-ink'
                        )}
                        title={`Map: ${l.map}`}
                      >
                        <Layers className="h-2.5 w-2.5" />
                        {l.role === 'hides' ? 'Hides Layer' : 'Gates Layer'}
                      </span>
                    ))}
                    {!usage?.triggers.length && !usage?.layers.length && (
                      <span className="text-faint text-[10px]">No active trigger bindings</span>
                    )}
                  </div>

                  {/* ACTION */}
                  <div className="flex justify-end">
                    {isSet && (
                      <button
                        type="button"
                        onClick={() => handleDelete(key)}
                        title="Clear Flag"
                        className="p-1 text-dim hover:text-alert"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
