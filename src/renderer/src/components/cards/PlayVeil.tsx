import { useRef } from 'react'
import { useEscapeLayer } from '../../lib/escape'
import { useShake } from '../../lib/useShake'
import { Die } from '../play/Die'
import { PlayStamp } from '../play/PlayStamp'
import { CardOf } from './LiveCard'
import { useLayoutNamed } from './model'
import { usePlayStage } from './playStage'

export function PlayVeil() {
  const stage = usePlayStage((s) => s.stage)
  const layout = useLayoutNamed(stage?.card.layout ?? null)
  const ref = useRef<HTMLDivElement>(null)
  useEscapeLayer(stage !== null && stage.outcome === null, () => stage?.close())
  useShake(ref, stage?.burning === true)
  if (!stage) return null
  return (
    <div ref={ref} className="play-veil pointer-events-auto" data-burning={stage.burning || undefined}>
      <div className="flex items-end gap-6 phone:flex-col phone:items-center phone:gap-4">
        <div className="play-veil-card w-64 phone:w-40">
          <CardOf card={stage.card} layout={layout} />
          {stage.face !== undefined && (
            <div className="play-veil-die">
              <Die value={stage.face} rolling={stage.face === null} />
            </div>
          )}
          {stage.outcome && <PlayStamp outcome={stage.outcome} />}
        </div>
        {stage.node && <div className="play-veil-panel w-[380px] phone:w-[min(380px,90vw)]">{stage.node}</div>}
      </div>
      {stage.burning && stage.outcome && <div className="play-flash" data-tone={stage.outcome.tone} />}
    </div>
  )
}
