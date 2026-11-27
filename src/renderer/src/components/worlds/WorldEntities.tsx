import { useState } from 'react'
import { Users, Shield, Flag, Dices, BookOpen, Lightbulb } from 'lucide-react'
import type { WorldMeta, WorldSchema } from '@shared/world'
import { WorldCharacters } from './WorldCharacters'
import { WorldFactions } from './WorldFactions'
import { WorldFlags } from './WorldFlags'
import { WorldActions } from './WorldActions'
import { WorldRecords } from './Records'
import { CodexButton } from './CodexButton'
import { WorldKnowledgeList } from './WorldKnowledgeList'

interface Props {
  world: WorldMeta
  schema: WorldSchema | null
  initialType?: string
  initialKey?: string
}

export function WorldEntities({ world, schema, initialType, initialKey }: Props) {
  const [category, setCategory] = useState<'characters' | 'factions' | 'knowledge' | 'flags' | 'actions' | 'records'>(
    initialType ? 'records' : 'characters'
  )

  const schemaTypes = schema ? Object.entries(schema.types) : []

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden border border-line/40 bg-bg">
      {/* LEFT CODEX SUB-RAIL */}
      <div className="flex w-60 shrink-0 flex-col border-r border-line/40 tone-sidebar-40 font-ui select-none">
        <div className="border-b border-line/30 p-2.5">
          <span className="text-[10px] caps-14 text-faint font-bold">
            World Codex &amp; State
          </span>
        </div>

        <div className="flex flex-col gap-0.5 p-1.5 overflow-y-auto min-h-0 flex-1 text-[11.5px]">
          <CodexButton active={category === 'characters'} onClick={() => setCategory('characters')} icon={Users} label="Characters & Party" />
          <CodexButton active={category === 'factions'} onClick={() => setCategory('factions')} icon={Shield} label="Factions & Standing" />
          <CodexButton active={category === 'knowledge'} onClick={() => setCategory('knowledge')} icon={Lightbulb} label="World Knowledge" />
          <CodexButton active={category === 'flags'} onClick={() => setCategory('flags')} icon={Flag} label="World Flags" tone="secondary" />
          <CodexButton active={category === 'actions'} onClick={() => setCategory('actions')} icon={Dices} label="Trigger Actions" />

          {schemaTypes.length > 0 && (
            <div className="mt-2 border-t border-line/30 pt-2">
              <div className="px-2 pb-1 text-[9.5px] caps-5 text-faint">
                Schema Records
              </div>
              <CodexButton active={category === 'records'} onClick={() => setCategory('records')} icon={BookOpen} label="Custom Records" count={schemaTypes.length} />
            </div>
          )}
        </div>
      </div>

      {/* RIGHT WORKSPACE PANE */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 bg-bg">
        {category === 'characters' && <WorldCharacters key={world.id} world={world} />}
        {category === 'factions' && <WorldFactions key={world.id} world={world} />}
        {category === 'knowledge' && <WorldKnowledgeList key={world.id} world={world} />}
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
