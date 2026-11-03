import { DecisionCardFrame } from './DecisionCardFrame'

export function AnsweringAbove({ tag, question }: { tag: string; question: string }) {
  return (
    <DecisionCardFrame tag={tag} question={question}>
      <span className="animate-pulse text-[12.5px] text-accent">Waiting for you in the panel above the message box.</span>
    </DecisionCardFrame>
  )
}
