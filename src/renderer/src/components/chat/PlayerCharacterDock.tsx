import type { AgentProfile } from '@shared/types'
import { showName } from '@shared/ids'
import { Popover, Field } from '../ui'
import { SheetSelect } from '../data/sheet/SheetSelect'
import { CharacterAvatar } from './CharacterAvatar'
import { changeAgent } from './changeAgent'
import { useEntryPreview } from '../entries/entryPreview'
import { openEntry } from '../../lib/library'
import { useWorlds } from '../worlds/Worlds'
import { useChatPlayer } from './useChatPlayer'
import { useCharacterStatus } from './status/useCharacterStatus'
import { HealthBar } from './status/HealthBar'
import { StatusDetails } from './status/StatusDetails'
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
  const activePlayer = useChatPlayer(agent)
  const preview = useEntryPreview(activePlayer ? `@sheet:${activePlayer}` : '')
  const valid = preview && !('missing' in preview) ? preview : null
  const playerName = valid ? showName(valid.title) : activePlayer ? showName(activePlayer) : null
  const status = useCharacterStatus(activePlayer)

  const handlePlayerChange = async (sheet: string | null) => {
    if (agent) await changeAgent(agent, { player: sheet }, 'player character')
    if (agent?.world?.worldId) {
      await engine('worlds.setPlayer', { id: agent.world.worldId, sheet }).catch(failed('Could not sync world player'))
    }
  }

  return (
    <Popover
      title="Player character"
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
              ? `You: ${playerName} · Click to switch character`
              : 'No player character · Click or right-click to choose your character'
          }
        >
          <CharacterAvatar sheetId={activePlayer} size={size} className="w-full h-full border-none" />
          {status?.health && <HealthBar health={status.health} className="absolute inset-x-0 top-0 h-1" />}
          {status && status.effects.length > 0 && <span className="pointer-events-none absolute right-0.5 top-1.5 h-1.5 w-1.5 rounded-full bg-purple" />}
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

      {status && <StatusDetails status={status} />}

      <Field label="Character">
        <SheetSelect
          value={activePlayer}
          onChange={(sheet) => void handlePlayerChange(sheet)}
          className="h-8 text-[12px]"
          noneLabel="None (Unassigned)"
        />
      </Field>

      <div className="text-[10.5px] text-faint">Your hand plays {playerName ? `${playerName}'s deck` : 'your own deck'}.</div>
    </Popover>
  )
}
