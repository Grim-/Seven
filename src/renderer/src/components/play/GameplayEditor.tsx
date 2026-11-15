import { CHANCE, defenceNames } from '@shared/actions'
import { BLANK_GAMEPLAY, cleanGameplay, GAMEPLAY_LANES, HIT_EVENT, MISS_EVENT, type GameplayCard } from '@shared/gameplayCard'
import { Effects, storedPiece } from '@shared/game/components'
import type { KindVariationProps } from '../../registries/kinds'
import { Field, FieldGrid, NumberField } from '../ui'
import { BrowsePick } from '../ui/BrowsePick'
import { SkillSelect } from '../decisions/SkillSelect'
import { EffectsEditor } from '../game/effects/EffectsEditor'

export function GameplayEditor({ entry, change }: KindVariationProps<Record<string, unknown>>) {
  const g = entry.gameplay ? cleanGameplay(entry.gameplay) : BLANK_GAMEPLAY
  const set = (patch: Partial<GameplayCard>) => change({ ...entry, gameplay: { ...g, ...patch } })
  const defences = defenceNames().map((d) => ({ value: d.id, label: d.label, group: d.group }))
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <FieldGrid dense>
        <Field label="Roll with">
          <SkillSelect chance value={g.check ?? ''} onChange={(check) => set({ check: check && check !== CHANCE ? check : null })} />
        </Field>
        <Field label="Extra bonus">
          <NumberField value={g.bonus} onChange={(v) => set({ bonus: v ?? 0 })} />
        </Field>
        <Field label="Against the target's">
          <BrowsePick value={g.defence} options={defences} placeholder="Fixed difficulty" onChange={(defence) => set({ defence })} />
        </Field>
        <Field label={g.defence ? 'Difficulty if it has none' : 'Difficulty'}>
          <NumberField value={g.dc} onChange={(v) => set({ dc: v ?? BLANK_GAMEPLAY.dc })} />
        </Field>
      </FieldGrid>
      <EffectsEditor
        host={Effects.type}
        lanes={GAMEPLAY_LANES}
        value={[...storedPiece(g.hit, HIT_EVENT), ...storedPiece(g.miss, MISS_EVENT), ...g.effects]}
        onChange={(effects) => set({ effects, hit: null, miss: null })}
      />
    </div>
  )
}
