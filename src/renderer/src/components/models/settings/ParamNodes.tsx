import type { ParamContext, ParamNode } from './paramTree'
import type { ModelConfigState } from './useModelConfig'
import { ParamRow } from './ParamRow'

export function ParamNodes({ nodes, ctx, state }: { nodes: ParamNode[]; ctx: ParamContext; state: ModelConfigState }) {
  return nodes.map((node) => (
    <ParamRow key={node.def.key} def={node.def} ctx={ctx} onChange={state.set} onReset={state.reset}>
      {node.children.length > 0 && <ParamNodes nodes={node.children} ctx={ctx} state={state} />}
    </ParamRow>
  ))
}
