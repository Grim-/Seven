import type { Component } from '@shared/game/core'
import { Section } from '../../data/sheet/dnd/Section'

export function GenericPanel({ comp }: { comp: Component }) {
  const rows = comp.tooltipRows()
  return (
    <Section title={comp.type}>
      {rows.length ? rows.map((r) => (
        <div key={r.label} className="flex gap-2 text-[13px]">
          <span className="flex-1 text-dim">{r.label}</span>
          <span className="font-ui text-ink/90">{r.value}</span>
        </div>
      )) : <span className="text-[12px] text-faint">Nothing to show.</span>}
    </Section>
  )
}
