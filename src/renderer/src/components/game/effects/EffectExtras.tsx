import { SlidersHorizontal } from 'lucide-react'
import type { ComponentDef, ParamSchema } from '@shared/game/core'
import { Eyebrow, Popover } from '../../ui'
import { ParamTokens } from '../ParamTokens'
import { hiddenKeys, type PieceClass } from './pieces'
import { paramsIn, parseSentence } from './sentence'
import { optionalShown } from './EffectSentence'
import { paramLabel } from '../params'

export function EffectExtras({ Class, def, revealed, reveal, onChange }: { Class: PieceClass; def: ComponentDef; revealed: Set<number>; reveal: (at: number) => void; onChange: (def: ComponentDef) => void }) {
  const parts = parseSentence(Class.SENTENCE)
  const named = new Set([...paramsIn(parts), ...hiddenKeys(Class)])
  const extra: ParamSchema = Object.fromEntries(Object.entries(Class.PARAMS).filter(([k]) => !named.has(k)))
  const optional = parts.flatMap((p) => ('optional' in p && !revealed.has(p.at) && !optionalShown(Class, def, p) ? [p] : []))
  if (!optional.length && !Object.keys(extra).length) return null
  return (
    <Popover
      title="More settings"
      className="notch-sm w-[min(22rem,94vw)] gap-3 p-3"
      triggerClassName="grid h-[26px] w-[26px] place-items-center text-faint hover:bg-white/5 hover:text-white"
      trigger={<SlidersHorizontal className="h-3.5 w-3.5" />}
    >
      {(close) => (
        <>
          {optional.length > 0 && <Eyebrow>Add to it</Eyebrow>}
          {optional.map((p) => (
            <button
              key={p.at}
              type="button"
              onClick={() => {
                reveal(p.at)
                close()
              }}
              className="border border-dashed border-line/70 px-2.5 py-1.5 text-left text-[13px] text-dim hover:border-accent hover:text-white"
            >
              …{p.optional.map((q, i) => ('text' in q ? <span key={i}>{q.text}</span> : 'param' in q ? <b key={i} className="font-mono text-white">{paramLabel(q.param, Class.PARAMS[q.param])}</b> : null))}
            </button>
          ))}
          {Object.keys(extra).length > 0 && <ParamTokens schema={extra} values={def} onChange={(next) => onChange({ ...def, ...next })} />}
        </>
      )}
    </Popover>
  )
}
