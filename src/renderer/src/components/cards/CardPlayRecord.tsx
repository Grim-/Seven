import { showName } from '@shared/ids'
import type { ChatElementProps } from '../../registries/chatElements'
import { PlayStamp } from '../play/PlayStamp'
import { EffectLinesList } from '../play/EffectLogElement'
import { CardBack } from './CardBack'
import { LiveCard } from './LiveCard'
import { readOutcome } from './cardPlay'
import { useCardPage } from './useCardPage'
import { Markdown } from '../chat/Markdown'

export function CardPlayRecord({ data }: ChatElementProps) {
  const name = typeof data.card === 'string' ? data.card : ''
  const said = typeof data.said === 'string' ? data.said : ''
  const outcome = readOutcome(data.outcome)
  const id = useCardPage(name)
  return (
    <div className="card-play-record">
      <div className="w-20 shrink-0 phone:w-14">{id ? <LiveCard id={id} /> : <CardBack className="w-full" />}</div>
      <div className="flex min-w-0 flex-col items-start gap-1.5">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-accent-soft">Played {showName(name)}</span>
        {said && <Markdown text={said} className="text-[13.5px] italic text-white" />}
        {outcome && <PlayStamp outcome={outcome} className="play-stamp-inline" />}
        {!!outcome?.effects?.length && <EffectLinesList lines={outcome.effects} />}
      </div>
    </div>
  )
}
