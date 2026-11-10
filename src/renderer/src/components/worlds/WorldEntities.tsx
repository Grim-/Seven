import { useState } from 'react'
import { Users, Shield, Flag, Dices, BookOpen } from 'lucide-react'
import type { WorldMeta, WorldSchema } from '@shared/world'
import { WorldCharacters } from './WorldCharacters'
import { WorldFactions } from './WorldFactions'
import { WorldFlags } from './WorldFlags'
import { WorldActions } from './WorldActions'
import { WorldRecords } from './Records'
import { cn } from '../../lib/cn'

interface Props {
  world: WorldMeta
  schema: WorldSchema | null
  initialType?: string
  initialKey?: string
}

export function WorldEntities({ world, schema, initialType, initialKey }: Props) {
  const [category, setCategory] = useState<'characters' | 'factions' | 'flags' | 'actions' | 'records'>(
    initialType ? 'records' : 'characters'
  )

  const schemaTypes = schema ? Object.entries(schema.types) : []

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden border border-line/40 bg-bg">
      {/* LEFT CODEX SUB-RAIL */}
      <div className="flex w-60 shrink-0 flex-col border-r border-line/40 bg-sidebar/40 font-mono select-none">
        <div className="border-b border-line/30 p-2.5">
          <span className="text-[10px] uppercase tracking-[0.14em] text-faint font-bold">
            World Codex &amp; State
          </span>
        </div>

        <div className="flex flex-col gap-0.5 p-1.5 overflow-y-auto min-h-0 flex-1 text-[11.5px]">
          <button
            type="button"
            onClick={() => setCategory('characters')}
            className={cn(
              'flex items-center justify-between px-2.5 py-2 text-left transition-colors border-l-2',
              category === 'characters'
                ? 'border-l-accent bg-accent/10 text-white font-bold'
                : 'border-l-transparent text-dim hover:bg-card/40 hover:text-white'
            )}
          >
            <div className="flex items-center gap-2 truncate">
              <Users className={cn('h-3.5 w-3.5', category === 'characters' ? 'text-accent' : 'text-faint')} />
              <span>Characters &amp; Party</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setCategory('factions')}
            className={cn(
              'flex items-center justify-between px-2.5 py-2 text-left transition-colors border-l-2',
              category === 'factions'
                ? 'border-l-accent bg-accent/10 text-white font-bold'
                : 'border-l-transparent text-dim hover:bg-card/40 hover:text-white'
            )}
          >
            <div className="flex items-center gap-2 truncate">
              <Shield className={cn('h-3.5 w-3.5', category === 'factions' ? 'text-accent' : 'text-faint')} />
              <span>Factions &amp; Standing</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setCategory('flags')}
            className={cn(
              'flex items-center justify-between px-2.5 py-2 text-left transition-colors border-l-2',
              category === 'flags'
                ? 'border-l-accent bg-accent/10 text-white font-bold'
                : 'border-l-transparent text-dim hover:bg-card/40 hover:text-white'
            )}
          >
            <div className="flex items-center gap-2 truncate">
              <Flag className={cn('h-3.5 w-3.5', category === 'flags' ? 'text-cyan' : 'text-faint')} />
              <span>World Flags</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setCategory('actions')}
            className={cn(
              'flex items-center justify-between px-2.5 py-2 text-left transition-colors border-l-2',
              category === 'actions'
                ? 'border-l-accent bg-accent/10 text-white font-bold'
                : 'border-l-transparent text-dim hover:bg-card/40 hover:text-white'
            )}
          >
            <div className="flex items-center gap-2 truncate">
              <Dices className={cn('h-3.5 w-3.5', category === 'actions' ? 'text-accent' : 'text-faint')} />
              <span>Trigger Actions</span>
            </div>
          </button>

          {schemaTypes.length > 0 && (
            <div className="mt-2 border-t border-line/30 pt-2">
              <div className="px-2 pb-1 text-[9.5px] uppercase tracking-wider text-faint">
                Schema Records
              </div>
              <button
                type="button"
                onClick={() => setCategory('records')}
                className={cn(
                  'flex items-center justify-between px-2.5 py-2 text-left transition-colors border-l-2 w-full',
                  category === 'records'
                    ? 'border-l-accent bg-accent/10 text-white font-bold'
                    : 'border-l-transparent text-dim hover:bg-card/40 hover:text-white'
                )}
              >
                <div className="flex items-center gap-2 truncate">
                  <BookOpen className={cn('h-3.5 w-3.5', category === 'records' ? 'text-accent' : 'text-faint')} />
                  <span>Custom Records</span>
                </div>
                <span className="text-[10px] text-faint">({schemaTypes.length})</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT WORKSPACE PANE */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 bg-bg">
        {category === 'characters' && <WorldCharacters key={world.id} world={world} />}
        {category === 'factions' && <WorldFactions key={world.id} world={world} />}
        {category === 'flags' && <WorldFlags key={world.id} world={world} />}
        {category === 'actions' && <WorldActions key={world.id} world={world} />}
        {category === 'records' && schema && (
          <WorldRecords
            key={world.id}
            worldId={world.id}
            schema={schema}
            initialType={initialType}
            initialKey={initialKey}
          />
        )}
      </div>
    </div>
  )
}
