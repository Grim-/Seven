import type { AgentProfile } from '@shared/types'
import type { CardSource } from '@shared/cardDecks'
import { showName } from '@shared/ids'
import { Popover, Field } from '../ui'
import { SheetSelect } from '../data/sheet/SheetSelect'
import { CardSourceSelect } from '../cards/CardSourceSelect'
import { CharacterAvatar } from './CharacterAvatar'
import { changeAgent } from './changeAgent'
import { useEntryPreview } from '../entries/entryPreview'
import { openEntry } from '../../lib/library'
import { useWorlds } from '../worlds/Worlds'
import { useWorldPlayer } from '../play/useWorldPlayer'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { cn } from '../../lib/cn'

export function PlayerCharacterDock({
  agent,
  size = 72,
  className
}: {
  agent: AgentProfile | null
  size?: number
  className?: string
}) {
  const worlds = useWorlds()
  const boundWorld = agent?.world?.worldId ? worlds.find((w) => w.id === agent.world!.worldId) ?? null : null
  const worldPlayer = useWorldPlayer(agent?.world?.worldId ?? null)
  const activePlayer = agent?.player || worldPlayer || null
  const preview = useEntryPreview(activePlayer ? `@sheet:${activePlayer}` : '')
  const valid = preview && !('missing' in preview) ? preview : null
  const playerName = valid ? showName(valid.title) : activePlayer ? showName(activePlayer) : null

  const handlePlayerChange = async (sheet: string | null) => {
    if (agent) await changeAgent(agent, { player: sheet }, 'player character')
    if (agent?.world?.worldId) {
      await engine('worlds.setPlayer', { id: agent.world.worldId, sheet }).catch(failed('Could not sync world player'))
    }
  }

  const handleCardsChange = (cards: CardSource | null) => {
    if (agent) void changeAgent(agent, { cards }, 'cards')
  }

  return (
    <Popover
      title="Player character and deck settings"
      className="w-72 gap-2.5 p-3 font-mono"
      side="top"
      align="start"
      trigger={
        <div
          style={{ width: size, height: size }}
          className={cn(
            'group relative flex shrink-0 cursor-pointer select-none items-center justify-center overflow-hidden border transition-all',
            activePlayer
              ? 'border-accent/70 bg-black/80 hover:border-accent hover:shadow-[0_0_12px_color-mix(in_srgb,var(--color-accent)_25%,transparent)]'
              : 'border-dashed border-line/60 bg-black/40 hover:border-accent/80 hover:bg-black/60',
            className
          )}
          title={
            activePlayer
              ? `You: ${playerName} · Click or right-click to switch character or deck`
              : 'No player character · Click or right-click to choose your character'
          }
        >
          <CharacterAvatar sheetId={activePlayer} size={size} className="w-full h-full border-none" />
          <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/75 to-transparent px-1 py-0.5 text-center font-mono text-[8.5px] font-bold uppercase tracking-wider text-accent truncate">
            {playerName ?? 'YOU'}
          </span>
        </div>
      }
    >
      <div className="flex items-center gap-2 border-b border-line/60 pb-2">
        <CharacterAvatar sheetId={activePlayer} size={32} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-bold uppercase tracking-wider text-white">
            {playerName ?? 'No Character'}
          </div>
          <div className="truncate text-[9.5px] text-faint">
            {boundWorld ? `World: ${boundWorld.name}` : 'Player Character'}
          </div>
        </div>
        {activePlayer && (
          <button
            type="button"
            onClick={() => openEntry('sheet', activePlayer)}
            className="notch-sm border border-line/60 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-dim hover:border-accent hover:text-white"
          >
            Open
          </button>
        )}
      </div>

      <Field label="Character">
        <SheetSelect
          value={activePlayer}
          onChange={(sheet) => void handlePlayerChange(sheet)}
          className="h-8 text-[12px]"
          noneLabel="None (Unassigned)"
        />
      </Field>

      {agent && (
        <Field label="Cards & Deck">
          <CardSourceSelect
            value={agent.cards ?? null}
            onChange={handleCardsChange}
            className="h-8 text-[12px]"
          />
        </Field>
      )}
    </Popover>
  )
}
