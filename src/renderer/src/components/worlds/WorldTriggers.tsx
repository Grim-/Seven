import { useState } from 'react'
import { Trash2, Zap, Pencil } from 'lucide-react'
import type { WorldMeta } from '@shared/world'
import { triggerType, triggerTypes, type TriggerDef } from '@shared/game/triggers'
import { Button, EmptyState, Modal, Select, confirmDelete } from '../ui'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { toast } from '../../store/toasts'
import { TriggerEditor } from '../play/triggers/TriggerEditor'

interface Props {
  world: WorldMeta
}

export function WorldTriggers({ world }: Props) {
  const [filterMap, setFilterMap] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [editingTrigger, setEditingTrigger] = useState<{ trigger: TriggerDef; mapId: string } | null>(null)

  const uses = useLive(() => engine('worlds.maps', { id: world.id }), 'worlds.changed') ?? []

  // Collect all triggers across all maps used in this world
  const placedTriggers: { trigger: TriggerDef; mapId: string }[] = []
  for (const u of uses) {
    for (const t of u.triggers ?? []) {
      placedTriggers.push({ trigger: t, mapId: u.map })
    }
  }

  const mapOptions = [{ value: 'all', label: 'All Maps' }, ...uses.map((u) => ({ value: u.map, label: `Map: ${u.map}` }))]
  const typeOptions = [{ value: 'all', label: 'All Types' }, ...triggerTypes().map((t) => ({ value: t.type, label: t.label }))]

  const filtered = placedTriggers.filter((item) => {
    if (filterMap !== 'all' && item.mapId !== filterMap) return false
    if (filterType !== 'all' && item.trigger.type !== filterType) return false
    return true
  })

  const handleSaveTrigger = async (next: TriggerDef, mapId: string) => {
    const targetUse = uses.find((u) => u.map === mapId)
    if (!targetUse) return
    const nextTriggers = (targetUse.triggers ?? []).map((t) => (t.id === next.id ? next : t))
    await engine('worlds.saveMapUse', { id: world.id, use: { ...targetUse, triggers: nextTriggers } })
    toast.success('Trigger Saved', next.name)
    setEditingTrigger(null)
  }

  const handleDeleteTrigger = (trigger: TriggerDef, mapId: string) => {
    confirmDelete(
      `Delete trigger "${trigger.name}"?`,
      `It will be removed from map "${mapId}".`,
      async () => {
        const targetUse = uses.find((u) => u.map === mapId)
        if (!targetUse) return
        const nextTriggers = (targetUse.triggers ?? []).filter((t) => t.id !== trigger.id)
        await engine('worlds.saveMapUse', { id: world.id, use: { ...targetUse, triggers: nextTriggers } })
        toast.success('Trigger Deleted', trigger.name)
      }
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 font-ui select-none">
      {/* HEADER & FILTERS */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-2.5">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-secondary-ink" />
          <span className="text-[12px] font-bold caps-5 text-ink">
            WORLD TRIGGERS
          </span>
          <span className="text-[11px] text-dim">
            ({placedTriggers.length} trigger{placedTriggers.length === 1 ? '' : 's'} across {uses.length} map{uses.length === 1 ? '' : 's'})
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={filterMap}
            options={mapOptions}
            onChange={setFilterMap}
            className="h-7 w-36 text-[11px]"
          />
          <Select
            value={filterType}
            options={typeOptions}
            onChange={setFilterType}
            className="h-7 w-36 text-[11px]"
          />
        </div>
      </div>

      {/* TRIGGERS GRID */}
      {filtered.length === 0 ? (
        <EmptyState title="No triggers found">
          {placedTriggers.length === 0
            ? 'No triggers have been placed on maps in this world yet. Place zones on maps or create triggers in the Trigger Kind library.'
            : 'No triggers match the selected filters.'}
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(({ trigger: t, mapId }) => {
            const def = triggerType(t.type)
            return (
              <div
                key={`${mapId}-${t.id}`}
                className="flex flex-col justify-between border border-line/60 tone-well-60 p-3 hover:border-line"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[13px] font-bold text-ink truncate">
                      {t.name}
                    </span>
                    <span className="border border-secondary-ink/40 bg-secondary-ink/15 px-1.5 py-0.5 text-[9px] font-bold text-secondary-ink caps-5 ">
                      {def?.label ?? t.type}
                    </span>
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="border border-line/40 bg-line/10 px-1 text-dim">
                      on {t.fires}
                    </span>
                    {t.once && (
                      <span className="border border-alert/40 bg-alert/15 px-1 text-alert">
                        once
                      </span>
                    )}
                    <span className="text-faint">Map: {mapId}</span>
                  </div>

                  {/* CONDITIONS */}
                  <div className="mt-2 flex flex-col gap-0.5 text-[10.5px] text-dim">
                    {t.needsItem && <div>Requires item: <strong className="text-ink">{t.needsItem}</strong></div>}
                    {t.needsFlag && <div>Requires flag: <strong className="text-ink">{t.needsFlag}</strong></div>}
                    {t.setsFlag && <div>Sets flag: <strong className="text-secondary-ink">{t.setsFlag}</strong></div>}
                  </div>
                </div>

                {/* ACTIONS */}
                <div className="mt-3 flex items-center justify-between border-t border-line/40 pt-2 text-[10.5px]">
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Pencil className="h-3 w-3" />}
                    onClick={() => setEditingTrigger({ trigger: t, mapId })}
                    className="h-6 text-[10px] px-2"
                  >
                    Edit
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Trash2 className="h-3 w-3" />}
                    onClick={() => handleDeleteTrigger(t, mapId)}
                    className="h-6 text-[10px] px-2 text-faint hover:text-alert"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* EDIT MODAL */}
      {editingTrigger && (
        <Modal
          title={`Edit Trigger: ${editingTrigger.trigger.name}`}
          open={true}
          onClose={() => setEditingTrigger(null)}
          wide={true}
        >
          <TriggerEditor
            start={editingTrigger.trigger}
            world={world.id}
            map={editingTrigger.mapId}
            onSave={(next) => handleSaveTrigger(next, editingTrigger.mapId)}
          />
        </Modal>
      )}
    </div>
  )
}
