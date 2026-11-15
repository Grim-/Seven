import { Fragment, useMemo, type ReactNode } from 'react'
import type { ComponentDef } from '@shared/game/core'
import { pieceClass, type PieceClass } from './pieces'
import { optionalOn, parseSentence, type SentencePart } from '@shared/game/effectWords'
import { EffectTokenButton, EffectTokenText } from './EffectTokenButton'

export const optionalShown = (Class: PieceClass, def: ComponentDef, part: { optional: SentencePart[] }): boolean => optionalOn(Class, def, part)

export function EffectSentence({ def, onChange, revealed, chips = false }: { def: ComponentDef; onChange?: (def: ComponentDef) => void; revealed?: Set<number>; chips?: boolean }) {
  const Class = pieceClass(def.type)
  const parts = useMemo(() => (Class ? parseSentence(Class.SENTENCE) : []), [Class])
  if (!Class) return <span className="font-mono text-dim">{def.type}</span>
  const token = (key: string): ReactNode => {
    const spec = Class.PARAMS[key]
    if (!spec) return `{${key}}`
    return onChange ? <EffectTokenButton key={key} name={key} spec={spec} value={def[key] ?? spec.default} onChange={(v) => onChange({ ...def, [key]: v })} /> : <EffectTokenText key={key} name={key} spec={spec} value={def[key] ?? spec.default} chip={chips} />
  }
  const draw = (list: SentencePart[]): ReactNode[] =>
    list.map((p, i) => {
      if ('text' in p) return <span key={i}>{p.text}</span>
      if ('param' in p) return <Fragment key={i}>{token(p.param)}</Fragment>
      return revealed?.has(p.at) || optionalShown(Class, def, p) ? <Fragment key={i}>{draw(p.optional)}</Fragment> : null
    })
  return <>{draw(parts)}</>
}
