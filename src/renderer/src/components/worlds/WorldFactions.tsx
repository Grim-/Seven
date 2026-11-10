import { useState } from 'react'
import { Flag, Plus, ExternalLink } from 'lucide-react'
import type { WorldMeta } from '@shared/world'
import type { StoredFaction } from '@shared/game/factions'
import { STANCE_BADGE } from '@shared/game/factions'
import { Button, EmptyState, Modal } from '../ui'
import { openEntry } from '../../lib/library'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { toast } from '../../store/toasts'
import { cn } from '../../lib/cn'
import { StoredFactionEditor } from '../factions/StoredFactionEditor'

interface Props {
  world: WorldMeta
}

export function WorldFactions({ world }: Props) {
  const factions = useLive(() => engine('factions.list'), 'factions.changed') ?? []
  const [editingFaction, setEditingFaction] = useState<StoredFaction | null>(null)

  const handleSaveFaction = async (saved: StoredFaction) => {
    await engine('factions.save', { faction: saved, previousId: editingFaction?.id })
    toast.success('Faction Saved', saved.name)
    setEditingFaction(null)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 font-mono select-none">
      {/* HEADER BAR */}
      <div className="flex items-center justify-between border-b border-line pb-2.5">
        <div className="flex items-center gap-2">
          <Flag className="h-4 w-4 text-cyan" />
          <span className="text-[12px] font-bold uppercase tracking-wider text-white">
            WORLD FACTIONS &amp; DIPLOMACY MATRIX
          </span>
          <span className="text-[11px] text-dim">
            ({factions.length} faction{factions.length === 1 ? '' : 's'} registered)
          </span>
        </div>

        <Button
          size="sm"
          variant="primary"
          icon={<Plus className="h-3.5 w-3.5" />}
          onClick={() =>
            setEditingFaction({
              id: '',
              name: '',
              description: '',
              defaultStance: 'neutral',
              relations: {},
              tags: [world.name.toLowerCase().replace(/\s+/g, '_')],
              updatedAt: Date.now()
            })
          }
        >
          New Faction
        </Button>
      </div>

      {/* MATRIX / FACTION LIST */}
      {factions.length === 0 ? (
        <EmptyState title="No factions registered">
          Factions define allegiances, motives, and hostility. Click "New Faction" to create your first faction.
        </EmptyState>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
          <div className="flex flex-col gap-3">
            {factions.map((f) => (
              <div
                key={f.id}
                className="flex flex-col gap-3 border border-line/60 bg-black/40 p-3.5"
              >
                {/* FACTION HEADER */}
                <div className="flex items-center justify-between border-b border-line/30 pb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[14px] font-bold text-white">{f.name}</span>
                    <span className="border border-line/50 px-1.5 py-0.5 font-mono text-[10.5px] text-accent">
                      @faction:{f.id}
                    </span>
                    <span className="font-mono text-[11px] text-dim">
                      Default:{' '}
                      <strong className={STANCE_BADGE[f.defaultStance].cls.split(' ')[0]}>
                        {f.defaultStance.toUpperCase()}
                      </strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingFaction(f)}
                    >
                      Edit Lore &amp; Stance
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<ExternalLink className="h-3.5 w-3.5" />}
                      onClick={() => openEntry('faction', f.id)}
                    >
                      Open in Data
                    </Button>
                  </div>
                </div>

                {/* DESCRIPTION / AGENT DIRECTIVE */}
                {f.description && (
                  <p className="line-clamp-2 text-[12px] leading-relaxed text-faint">
                    {f.description}
                  </p>
                )}

                {/* RELATIONS OVERVIEW FOR THIS FACTION */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="font-mono text-[10.5px] uppercase tracking-wider text-faint">
                    Stance toward others:
                  </span>
                  {factions
                    .filter((other) => other.id !== f.id)
                    .map((other) => {
                      const stance = f.relations[other.id] ?? f.defaultStance
                      const cfg = STANCE_BADGE[stance]
                      return (
                        <div
                          key={other.id}
                          className="flex items-center gap-1.5 border border-line/40 bg-black/50 px-2 py-1 text-[11px]"
                        >
                          <span className="text-white/90">{other.name}:</span>
                          <span className={cn('px-1.5 py-0.2 border text-[10px] font-bold', cfg.cls)}>
                            {cfg.label}
                          </span>
                        </div>
                      )
                    })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingFaction && (
        <Modal
          open={true}
          title={editingFaction.id ? `Edit Faction: ${editingFaction.name}` : 'New Faction'}
          onClose={() => setEditingFaction(null)}
          wide={true}
        >
          <div className="flex flex-col gap-4 p-4">
            <StoredFactionEditor
              value={editingFaction}
              onChange={setEditingFaction}
            />
            <div className="flex justify-end gap-2 border-t border-line/40 pt-3">
              <Button size="sm" variant="ghost" onClick={() => setEditingFaction(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="primary"
                disabled={!editingFaction.name.trim()}
                onClick={() => handleSaveFaction(editingFaction)}
              >
                Save Faction
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
