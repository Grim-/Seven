import type { MouseEvent } from 'react'
import {
  BookOpen,
  Braces,
  Dices,
  ExternalLink,
  Flag,
  Flame,
  FolderOpen,
  Layers,
  Lightbulb,
  Map as MapIcon,
  MapPin,
  MessageSquare,
  Plus,
  Shield,
  Sparkles,
  Trash2,
  Unlink,
  User,
  Users,
  type LucideIcon
} from 'lucide-react'
import type { WorldMapUse } from '@shared/maps'
import type { WorldMeta } from '@shared/world'
import { showName } from '@shared/ids'
import { cn } from '../../lib/cn'
import { formatRelative } from '../../lib/format'
import { engine } from '../../lib/ipc'
import { openEntry } from '../../lib/library'
import { failed } from '../../lib/notify'
import { entryMenuAt } from '../../views/data/entryMenu'
import { Button, Eyebrow, Popover, Select, TagInput, openMenu, type MenuItem } from '../ui'
import { EntryPicker } from '../library/EntryPicker'

export type WorldSectionId =
  | 'regions'
  | 'places'
  | 'events'
  | 'board'
  | 'opening'
  | 'characters'
  | 'factions'
  | 'knowledge'
  | 'flags'
  | 'actions'
  | 'records'
  | 'schema'

export type WorldFocus =
  | { kind: 'map'; mapId: string | null }
  | { kind: 'section'; section: WorldSectionId }

export interface OutlineItem {
  id: WorldSectionId
  group: 'world' | 'codex' | 'structure'
  label: string
  icon: LucideIcon
  count?: number
  accentCount?: boolean
  tone?: 'accent' | 'secondary'
  hidden?: boolean
}

interface WorldOutlineProps {
  worlds: WorldMeta[]
  world: WorldMeta
  focus: WorldFocus
  mapUses: WorldMapUse[]
  mapNameOf: (id: string) => string
  regionCount: number
  placeCount: number
  eventCount: number
  waitingEventCount: number
  schemaTypeCount: number
  onSelectWorld: (id: string) => void
  onCreateWorld: () => void
  onDeleteWorld: (w: WorldMeta) => void
  onFocus: (next: WorldFocus) => void
  onUseMap: (mapId: string) => void
  onDropMap: (mapId: string) => void
}

function OutlineRow({
  active,
  icon: Icon,
  label,
  count,
  accentCount,
  tone = 'accent',
  onClick,
  onContextMenu,
  trailing
}: {
  active: boolean
  icon: LucideIcon
  label: string
  count?: number
  accentCount?: boolean
  tone?: 'accent' | 'secondary'
  onClick: () => void
  onContextMenu?: (e: MouseEvent) => void
  trailing?: React.ReactNode
}) {
  return (
    <div
      onContextMenu={onContextMenu}
      className={cn(
        'group/row flex items-center border-l-2 transition-colors',
        active
          ? 'border-l-accent bg-accent/10 text-ink'
          : 'border-l-transparent text-dim hover:tone-card-40 hover:text-ink'
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center justify-between gap-2 px-2.5 py-1.5 text-left text-[12px]"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Icon
            className={cn(
              'h-3.5 w-3.5 shrink-0',
              active ? (tone === 'secondary' ? 'text-secondary-ink' : 'text-accent') : 'text-faint group-hover/row:text-dim'
            )}
          />
          <span className={cn('truncate', active && 'font-semibold')}>{label}</span>
        </span>
        {count !== undefined && (
          <span
            className={cn(
              'shrink-0 font-data text-[10px]',
              accentCount && count > 0 ? 'font-semibold text-accent' : 'text-faint'
            )}
          >
            {count}
          </span>
        )}
      </button>
      {trailing && (
        <div className="flex shrink-0 items-center gap-0.5 pr-1.5 opacity-0 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100">
          {trailing}
        </div>
      )}
    </div>
  )
}

const GROUPS: { id: OutlineItem['group']; label: string }[] = [
  { id: 'world', label: 'World' },
  { id: 'codex', label: 'Codex & State' },
  { id: 'structure', label: 'Structure' }
]

export function WorldOutline({
  worlds,
  world,
  focus,
  mapUses,
  mapNameOf,
  regionCount,
  placeCount,
  eventCount,
  waitingEventCount,
  schemaTypeCount,
  onSelectWorld,
  onCreateWorld,
  onDeleteWorld,
  onFocus,
  onUseMap,
  onDropMap
}: WorldOutlineProps) {
  const worldMenu = (e: MouseEvent) =>
    entryMenuAt(e, 'world', world.id, world.name, [
      { label: 'Open', icon: <FolderOpen />, onSelect: () => onSelectWorld(world.id) },
      { label: 'Delete', icon: <Trash2 />, danger: true, onSelect: () => onDeleteWorld(world) }
    ])

  const mapMenuItems = (mapId: string): MenuItem[] => [
    { label: 'Open in Map Editor', icon: <ExternalLink />, onSelect: () => openEntry('map', mapId) },
    { label: 'Remove from World', icon: <Unlink />, danger: true, onSelect: () => onDropMap(mapId) }
  ]

  const sections: OutlineItem[] = [
    { id: 'regions', group: 'world', label: 'Regions', icon: Layers, count: regionCount },
    { id: 'places', group: 'world', label: 'Places', icon: MapPin, count: placeCount },
    {
      id: 'events',
      group: 'world',
      label: 'Events',
      icon: Flame,
      count: eventCount,
      accentCount: waitingEventCount > 0
    },
    { id: 'board', group: 'world', label: 'Board', icon: MessageSquare, count: world.posts },
    { id: 'opening', group: 'world', label: 'Opening', icon: Sparkles },
    { id: 'characters', group: 'codex', label: 'Characters & Party', icon: Users },
    { id: 'factions', group: 'codex', label: 'Factions & Standing', icon: Shield },
    { id: 'knowledge', group: 'codex', label: 'World Knowledge', icon: Lightbulb },
    { id: 'flags', group: 'codex', label: 'World Flags', icon: Flag, tone: 'secondary' },
    { id: 'actions', group: 'codex', label: 'Trigger Actions', icon: Dices },
    {
      id: 'records',
      group: 'codex',
      label: 'Custom Records',
      icon: BookOpen,
      count: schemaTypeCount,
      hidden: schemaTypeCount === 0
    },
    { id: 'schema', group: 'structure', label: 'Schema', icon: Braces, count: schemaTypeCount }
  ]

  return (
    <div className="flex h-full min-h-0 flex-col border-r border-line/40 tone-sidebar-60 font-ui select-none">
      {/* WORLD SWITCHER & SUMMARY */}
      <div className="flex flex-col gap-1.5 border-b border-line/40 p-2.5" onContextMenu={worldMenu}>
        <div className="flex items-center gap-1.5">
          {worlds.length > 1 ? (
            <Select
              value={world.id}
              onChange={onSelectWorld}
              options={worlds.map((w) => ({ value: w.id, label: w.name }))}
              className="h-7 min-w-0 flex-1 text-[12px] font-semibold"
            />
          ) : (
            <div className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink" title={world.name}>
              {world.name}
            </div>
          )}
          <Button
            size="sm"
            variant="ghost"
            icon={<Plus className="h-3.5 w-3.5" />}
            onClick={onCreateWorld}
            title="New world"
            className="h-7 w-7 shrink-0 px-0"
          />
        </div>

        {/* AT-A-GLANCE WORLD META */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px] text-dim">
          <Popover
            align="start"
            title="Your character in this world"
            className="w-72 p-2.5"
            trigger={
              <button
                type="button"
                className="flex min-w-0 cursor-pointer items-center gap-1 truncate text-left text-dim transition-colors hover:text-ink"
                title="Click to select which character you play in this world"
              >
                <User className="h-3 w-3 shrink-0 text-accent" />
                <span className="truncate underline decoration-line/50 underline-offset-2 hover:decoration-accent">
                  {world.player ? showName(world.player) : 'Select character…'}
                </span>
              </button>
            }
          >
            {(close) => (
              <div className="flex flex-col gap-2 font-ui">
                <EntryPicker
                  kind="sheet"
                  title="Select Character"
                  inline
                  onClose={close}
                  onPick={(hit) => {
                    close()
                    void engine('worlds.setPlayer', { id: world.id, sheet: hit.id }).catch(
                      failed('Could not set your character')
                    )
                  }}
                />
                {world.player && (
                  <div className="flex items-center justify-between border-t border-line/30 pt-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        close()
                        openEntry('sheet', world.player!)
                      }}
                      className="cursor-pointer text-[11px] text-accent hover:underline"
                    >
                      Open {showName(world.player)}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        close()
                        void engine('worlds.setPlayer', { id: world.id, sheet: null }).catch(
                          failed('Could not clear your character')
                        )
                      }}
                      className="cursor-pointer text-[11px] text-dim hover:text-alert"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
            )}
          </Popover>
          <span className="text-faint">·</span>
          <span className="shrink-0 text-faint">
            {mapUses.length} {mapUses.length === 1 ? 'map' : 'maps'}
          </span>
          <span className="text-faint">·</span>
          <span className="shrink-0 text-faint">
            {placeCount} {placeCount === 1 ? 'place' : 'places'}
          </span>
        </div>

        <Popover
          align="start"
          title="World tags"
          className="w-72 p-2.5"
          trigger={
            <button
              type="button"
              className="flex flex-wrap items-center gap-1 pt-0.5 text-left cursor-pointer group"
              title="Click to edit world tags"
            >
              {world.tags.slice(0, 4).map((t) => (
                <span key={t} className="border border-line/40 tone-well-60 px-1.5 py-0.5 text-[9.5px] text-dim group-hover:border-accent/50 group-hover:text-ink">
                  #{t}
                </span>
              ))}
              {world.tags.length > 4 && (
                <span className="px-1 py-0.5 text-[9.5px] text-faint">+{world.tags.length - 4}</span>
              )}
              {world.tags.length === 0 && (
                <span className="text-[9.5px] text-faint group-hover:text-accent">+ Add tags…</span>
              )}
            </button>
          }
        >
          <div className="font-ui">
            <TagInput
              value={world.tags}
              suggestions={[...new Set(worlds.flatMap((w) => w.tags))]}
              onChange={(tags) =>
                void engine('worlds.setTags', { id: world.id, tags }).catch(failed('Could not save the tags'))
              }
            />
          </div>
        </Popover>
      </div>

      {/* SCROLLABLE OUTLINE TREE */}
      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        {/* MAPS GROUP */}
        <div className="mb-3">
          <div className="flex items-center justify-between px-2.5 pb-1">
            <Eyebrow>Maps ({mapUses.length})</Eyebrow>
            <Popover
              trigger={
                <span className="flex items-center gap-0.5 text-[10px] caps text-accent hover:text-ink">
                  <Plus className="h-3 w-3" />
                  Link
                </span>
              }
              title="Use a map from Map Editor"
            >
              {(close) => (
                <EntryPicker
                  kind="map"
                  title="Use a map"
                  inline
                  onClose={close}
                  onPick={(hit) => {
                    onUseMap(hit.id)
                    close()
                  }}
                />
              )}
            </Popover>
          </div>
          {mapUses.length === 0 ? (
            <button
              type="button"
              onClick={() => onFocus({ kind: 'map', mapId: null })}
              className={cn(
                'flex w-full items-center gap-2 border-l-2 px-2.5 py-1.5 text-left text-[11.5px] text-faint hover:tone-card-40 hover:text-dim',
                focus.kind === 'map' ? 'border-l-accent bg-accent/10 text-dim' : 'border-l-transparent'
              )}
            >
              <MapIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">No maps linked</span>
            </button>
          ) : (
            mapUses.map((u) => {
              const name = mapNameOf(u.map)
              const shapedCount = Object.keys(u.shapes ?? {}).length
              const active = focus.kind === 'map' && focus.mapId === u.map
              return (
                <OutlineRow
                  key={u.map}
                  active={active}
                  icon={MapIcon}
                  label={name}
                  count={shapedCount > 0 ? shapedCount : undefined}
                  onClick={() => onFocus({ kind: 'map', mapId: u.map })}
                  onContextMenu={(e) => openMenu(e, name, mapMenuItems(u.map))}
                  trailing={
                    <>
                      <button
                        type="button"
                        title="Open in Map Editor"
                        onClick={(e) => {
                          e.stopPropagation()
                          openEntry('map', u.map)
                        }}
                        className="p-0.5 text-dim hover:text-accent"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        title="Remove from World"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDropMap(u.map)
                        }}
                        className="p-0.5 text-dim hover:text-alert"
                      >
                        <Unlink className="h-3 w-3" />
                      </button>
                    </>
                  }
                />
              )
            })
          )}
        </div>

        {/* SECTION GROUPS */}
        {GROUPS.map((group) => {
          const items = sections.filter((s) => s.group === group.id && !s.hidden)
          if (!items.length) return null
          return (
            <div key={group.id} className="mb-3">
              <div className="px-2.5 pb-1">
                <Eyebrow>{group.label}</Eyebrow>
              </div>
              {items.map((item) => (
                <OutlineRow
                  key={item.id}
                  active={focus.kind === 'section' && focus.section === item.id}
                  icon={item.icon}
                  label={item.label}
                  count={item.count}
                  accentCount={item.accentCount}
                  tone={item.tone}
                  onClick={() => onFocus({ kind: 'section', section: item.id })}
                />
              ))}
            </div>
          )
        })}
      </div>

      {/* FOOTER */}
      {world.updatedAt && (
        <div className="border-t border-line/30 px-2.5 py-1.5 text-[10px] text-faint">
          Updated {formatRelative(world.updatedAt)}
        </div>
      )}
    </div>
  )
}
