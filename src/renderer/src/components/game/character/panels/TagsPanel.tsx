import { Tags, allEntityTags } from '@shared/game/components'
import { ChipInput, TraitChips } from '../../../ui'
import { GamePanel } from '../../../../game/ui'
import { useKnownGameTags } from '../../useGameSuggestions'
import { registerComponentPanel, type PanelProps } from './registry'

function TagsPanel({ comp, entity, changed }: PanelProps<Tags>) {
  const knownTags = useKnownGameTags()
  const direct = comp.list()
  const derived = allEntityTags(entity).filter((t) => !comp.has(t))
  const total = direct.length + derived.length

  return (
    <GamePanel title="Tags" aside={total ? `${total} active` : 'none'} bodyClassName="gap-2 p-3">
      <ChipInput
        value={direct}
        suggestions={knownTags}
        onChange={(next) => {
          comp.params.values = next
          changed()
        }}
        placeholder="Pick tag or type new…"
      />
      {derived.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-line/25 pt-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-dim">Inherited</span>
          <TraitChips traits={derived.map((t) => ({ key: t, label: t, tone: 'busy' as const }))} />
        </div>
      )}
    </GamePanel>
  )
}

registerComponentPanel(Tags.type, { Panel: TagsPanel })
