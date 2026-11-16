import { Plus, X } from 'lucide-react'
import type { ParamSchema } from '@shared/game/core/params'
import type { ClassReward } from '@shared/game/defs/classes'
import { ABILITY_TEMPLATES, TRAIT_TEMPLATES } from '@shared/game/defs'
import { Button, Panel, RowAction } from '../../ui'
import { ParamTokens } from '../ParamTokens'
import { registerParamEditor, type ParamEditorProps } from './registry'

const REWARD_SCHEMA: ParamSchema = {
  level: { label: 'Level', kind: 'number', default: 1, min: 1, description: 'Class level that unlocks these rewards.' },
  permanent: { label: 'Permanent', kind: 'flag', default: false, description: 'Keep these rewards even if the character loses this class.' },
  summary: { label: 'Summary', kind: 'text', default: '', description: 'Short summary displayed on the class milestones view.' },
  stats: { label: 'Stats', kind: 'values', templateKind: 'stat', default: {}, description: 'Stat bonuses unlocked at this level.' },
  skills: { label: 'Skills', kind: 'values', templateKind: 'check', default: {}, description: 'Skill check bonuses unlocked at this level.' },
  traits: {
    label: 'Traits',
    kind: 'list',
    default: [],
    of: { kind: 'template', templateKind: TRAIT_TEMPLATES, default: '', description: 'Trait granted at this level.' },
    description: 'Innate traits granted at this level.'
  },
  abilities: {
    label: 'Abilities',
    kind: 'list',
    default: [],
    of: { kind: 'template', templateKind: ABILITY_TEMPLATES, default: '', description: 'Ability granted at this level.' },
    description: 'Abilities unlocked at this level.'
  },
  tags: { label: 'Tags', kind: 'list', default: [], description: 'Keyword tags granted at this level.' }
}

function ClassRewardsEdit({ value, onChange }: ParamEditorProps) {
  const rewards = Array.isArray(value) ? (value as ClassReward[]) : []
  const patch = (i: number, next: Record<string, unknown>) =>
    onChange(rewards.map((r, j) => (j === i ? (next as unknown as ClassReward) : r)))
  const nextLevel = rewards.reduce((m, r) => Math.max(m, Number(r.level || 0)), 0) + 1

  return (
    <div className="flex flex-col gap-2.5">
      {rewards.map((reward, i) => (
        <Panel
          key={i}
          collapsible
          defaultOpen
          title={`Level ${reward.level}`}
          meta={reward.summary || (reward.permanent ? 'Permanent' : undefined)}
          actions={
            <RowAction
              danger
              icon={<X />}
              title="Remove milestone"
              onClick={() => onChange(rewards.filter((_, j) => j !== i))}
            />
          }
          bodyClassName="p-3"
        >
          <ParamTokens schema={REWARD_SCHEMA} values={reward as unknown as Record<string, unknown>} onChange={(next) => patch(i, next)} />
        </Panel>
      ))}
      <Button size="sm" variant="ghost" icon={<Plus />} className="self-start" onClick={() => onChange([...rewards, { level: nextLevel }])}>
        Add milestone
      </Button>
    </div>
  )
}

registerParamEditor('classRewards', { Editor: ClassRewardsEdit, wide: true })
