import type { CSSProperties } from 'react'
import type { ComponentDef } from '@shared/game/core'
import type { EffectLane } from '@shared/game/components'
import { laneTree, type EffectNode } from '@shared/game/effectWords'
import { NamedIcon } from '../../ui'
import { EffectSentence } from './EffectSentence'
import { pieceClass, toneOf } from './pieces'

function Nodes({ nodes }: { nodes: EffectNode[] }) {
  return (
    <div className="flex flex-col gap-[0.45em]">
      {nodes.map((n, i) => (
        <div key={i} className="flex flex-col gap-[0.35em]">
          <div style={{ '--tone': toneOf(n.def) } as CSSProperties} className="flex items-start gap-[0.45em] border-l-2 border-[var(--tone)] pl-[0.55em] leading-[1.65]">
            <NamedIcon name={pieceClass(n.def.type)?.ICON ?? 'Sparkles'} className="mt-[0.3em] h-[1em] w-[1em] shrink-0 text-[var(--tone)]" />
            <span className="min-w-0">
              <EffectSentence def={n.def} chips />
            </span>
          </div>
          {n.arms.map((arm, a) =>
            arm.nodes.length ? (
              <div key={a} className="ml-[0.5em] flex flex-col gap-[0.35em] border-l border-white/12 pl-[0.55em]">
                <span className={arm.branch.tone === 'pass' ? 'font-mono text-[0.82em] font-semibold uppercase tracking-[0.08em] text-ok' : 'font-mono text-[0.82em] font-semibold uppercase tracking-[0.08em] text-alert'}>{arm.branch.label}</span>
                <Nodes nodes={arm.nodes} />
              </div>
            ) : null
          )}
        </div>
      ))}
    </div>
  )
}

export function EffectsView({ defs, lanes }: { defs: ComponentDef[]; lanes: EffectLane[] }) {
  const tree = laneTree(defs, lanes).filter((l) => l.nodes.length)
  if (!tree.length) return <span className="text-faint">No effects.</span>
  return (
    <div className="flex flex-col gap-[0.75em]">
      {tree.map((l) => (
        <div key={l.lane.event} className="flex flex-col gap-[0.4em]">
          <span className="font-mono text-[0.82em] font-semibold uppercase tracking-[0.1em] text-dim">{l.lane.label}</span>
          <Nodes nodes={l.nodes} />
        </div>
      ))}
    </div>
  )
}
