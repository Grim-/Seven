import type { CSSProperties } from 'react'
import type { ComponentDef } from '@shared/game/core'
import type { EffectLane } from '@shared/game/components'
import { laneTree, type EffectNode } from '@shared/game/effectWords'
import { NamedIcon } from '../../ui'
import { EffectSentence } from './EffectSentence'
import { pieceClass, toneOf } from './pieces'

function Nodes({ nodes }: { nodes: EffectNode[] }) {
  return (
    <>
      {nodes.map((n, i) => (
        <div key={i} className="flex flex-col gap-1">
          <div style={{ '--tone': toneOf(n.def) } as CSSProperties} className="flex items-start gap-1.5 border-l-2 border-[var(--tone)] pl-1.5 leading-snug">
            <NamedIcon name={pieceClass(n.def.type)?.ICON ?? 'Sparkles'} className="mt-[2px] h-3 w-3 shrink-0 text-[var(--tone)]" />
            <span>
              <EffectSentence def={n.def} chips />
            </span>
          </div>
          {n.arms.map((arm, a) =>
            arm.nodes.length ? (
              <div key={a} className="ml-2.5 flex flex-col gap-1">
                <span className={arm.branch.tone === 'pass' ? 'font-mono text-[0.8em] uppercase tracking-wider text-ok' : 'font-mono text-[0.8em] uppercase tracking-wider text-alert'}>{arm.branch.label}</span>
                <Nodes nodes={arm.nodes} />
              </div>
            ) : null
          )}
        </div>
      ))}
    </>
  )
}

export function EffectsView({ defs, lanes }: { defs: ComponentDef[]; lanes: EffectLane[] }) {
  const tree = laneTree(defs, lanes).filter((l) => l.nodes.length)
  if (!tree.length) return <span className="text-faint">No effects.</span>
  return (
    <div className="flex flex-col gap-1.5">
      {tree.map((l) => (
        <div key={l.lane.event} className="flex flex-col gap-1">
          <span className="font-mono text-[0.8em] uppercase tracking-wider text-dim">{l.lane.label}</span>
          <Nodes nodes={l.nodes} />
        </div>
      ))}
    </div>
  )
}
