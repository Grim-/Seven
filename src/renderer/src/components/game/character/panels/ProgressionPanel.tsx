import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Progression, xpCurveChoices } from '@shared/game/components'
import { Button, CountStepper } from '../../../ui'
import { GameBar, GamePanel } from '../../../../game/ui'
import { EffectTokenButton } from '../../effects/EffectTokenButton'
import { registerComponentPanel, type PanelProps } from './registry'

function ProgressionPanel({ comp, changed }: PanelProps<Progression>) {
  const [award, setAward] = useState<number>(100)
  const needed = comp.xpNeeded()
  return (
    <GamePanel
      title="Level & XP"
      action={
        <div className="flex items-center gap-1.5 [--tone:var(--color-accent)]">
          <span className="font-label text-[10px] caps-10 text-dim">Curve</span>
          <EffectTokenButton
            name="curve"
            spec={{ kind: 'choice', choices: xpCurveChoices(), default: 'standard', description: 'XP curve rate for level thresholds.' }}
            value={comp.curve}
            onChange={(curve) => {
              comp.params.curve = String(curve || 'standard')
              changed()
            }}
          />
        </div>
      }
      bodyClassName="gap-2 p-2.5 [--tone:var(--color-accent)]"
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <span className="font-label text-[10px] font-bold caps-12 text-accent">Lv</span>
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

        <div className="flex min-w-[7rem] flex-1 items-center gap-2">
          <GameBar value={comp.xp} max={needed} colour={null} size="sm" className="flex-1" />
          <span className="shrink-0 font-data text-[11px] tabular-nums text-dim">
            {comp.xp}/{needed}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
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
            title="Award XP (cascades equally to every owned class)"
            onClick={() => {
              comp.grantXp(award, 'sheet')
              changed()
            }}
          >
            XP
          </Button>
        </div>
      </div>
    </GamePanel>
  )
}

registerComponentPanel(Progression.type, { Panel: ProgressionPanel })
