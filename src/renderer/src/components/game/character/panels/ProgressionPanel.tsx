import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Progression, xpCurveChoices } from '@shared/game/components'
import { Button, CountStepper, Meter } from '../../../ui'
import { GamePanel } from '../../../../game/ui'
import { EffectTokenButton } from '../../effects/EffectTokenButton'
import { registerComponentPanel, type PanelProps } from './registry'

function ProgressionPanel({ comp, changed }: PanelProps<Progression>) {
  const [award, setAward] = useState<number>(100)
  const needed = comp.xpNeeded()
  const ratio = Math.min(1, Math.max(0, comp.xp / Math.max(1, needed)))
  return (
    <GamePanel
      title="Level & XP"
      aside={`Curve: ${comp.curve}`}
      action={
        <EffectTokenButton
          name="curve"
          spec={{ kind: 'choice', choices: xpCurveChoices(), default: 'standard', description: 'XP curve rate for level thresholds.' }}
          value={comp.curve}
          onChange={(curve) => {
            comp.params.curve = String(curve || 'standard')
            changed()
          }}
        />
      }
      bodyClassName="gap-2.5 p-3 [--tone:var(--color-accent)]"
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-2 border border-accent/40 bg-accent/10 px-2 py-1">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-accent">LV</span>
          <CountStepper
            small
            value={comp.level}
            min={1}
            max={999}
            onChange={(next) => {
              comp.setLevel(next)
              changed()
            }}
          />
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <EffectTokenButton
            name="xp"
            spec={{ kind: 'number', default: 100, min: 1, description: 'Experience points to award (cascades equally to every owned class).' }}
            value={award}
            onChange={(v) => setAward(Math.max(1, Number(v || 100)))}
          />
          <Button
            size="sm"
            variant="primary"
            icon={<Plus />}
            onClick={() => {
              comp.grantXp(award, 'sheet')
              changed()
            }}
          >
            Award XP
          </Button>
        </div>
      </div>
      <Meter label={`XP · Level ${comp.level}`} value={ratio} text={`${comp.xp} / ${needed}`} note="Cascades equally to every owned class" />
    </GamePanel>
  )
}

registerComponentPanel(Progression.type, { Panel: ProgressionPanel })
