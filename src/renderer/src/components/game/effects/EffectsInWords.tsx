import { Eyebrow } from '../../ui'
import { EffectSentence } from './EffectSentence'
import type { EffectNode, LaneNodes } from './tree'

function Lines({ nodes, depth }: { nodes: EffectNode[]; depth: number }) {
  return (
    <>
      {nodes.map((n, i) => (
        <div key={i} className="flex flex-col gap-1">
          <p style={{ paddingLeft: `${depth}rem` }}>
            <EffectSentence def={n.def} />.
          </p>
          {n.arms.map((arm, a) =>
            arm.nodes.length ? (
              <div key={a} className="flex flex-col gap-1">
                <p style={{ paddingLeft: `${depth + 0.5}rem` }} className={arm.branch.tone === 'pass' ? 'text-ok' : 'text-alert'}>
                  {arm.branch.label}:
                </p>
                <Lines nodes={arm.nodes} depth={depth + 1} />
              </div>
            ) : null
          )}
        </div>
      ))}
    </>
  )
}

export function EffectsInWords({ tree }: { tree: LaneNodes[] }) {
  return (
    <section className="flex flex-col gap-2">
      <Eyebrow>In words</Eyebrow>
      {tree.map((l) => (
        <div key={l.lane.event} className="flex flex-col gap-1 text-[13.5px] leading-relaxed text-ink/80">
          <Eyebrow className="text-faint">{l.lane.label}</Eyebrow>
          {l.nodes.length ? <Lines nodes={l.nodes} depth={0} /> : <p className="text-faint">Nothing.</p>}
        </div>
      ))}
    </section>
  )
}
