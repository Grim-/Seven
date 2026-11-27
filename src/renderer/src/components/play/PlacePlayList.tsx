import type { ReactNode } from 'react'
import { parseActions } from '@shared/actions'
import { parseDecisions } from '@shared/decisions'
import { Button, Eyebrow, openMenu, type MenuItem } from '../ui'
import { useAgents } from '../../store/agents'
import { cn } from '../../lib/cn'
import { actionItems, decisionItems, type PlacePlay } from './placePlay'

function Row({ tag, title, chip, items, purple }: { tag: string; title: string; chip: string; items: MenuItem[]; purple?: boolean }) {
  const [first] = items
  return (
    <div onContextMenu={(e) => openMenu(e, title, items)} className="flex items-center gap-2 border border-line/40 bg-ink/[0.015] px-2 py-1.5">
      <span className={cn('shrink-0 border px-1 font-ui text-[9.5px] font-bold', purple ? 'border-tint-purple/50 text-tint-purple' : 'border-accent/60 text-accent')}>{tag}</span>
      <span className="min-w-0 flex-1 text-[12.5px] text-ink/90">{title}</span>
      <span className="shrink-0 border border-line/50 px-1.5 font-ui text-[10px] text-dim">{chip}</span>
      <Button size="sm" variant={purple ? 'secondary' : 'primary'} icon={first.icon} onClick={first.onSelect}>
        {first.label}
      </Button>
    </div>
  )
}

function Section({ label, empty, children }: { label: string; empty: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Eyebrow>{label}</Eyebrow>
      {empty ? <span className="text-[12px] text-faint">None kept here.</span> : children}
    </div>
  )
}

export function PlacePlayList({ play }: { play: PlacePlay }) {
  const agents = useAgents((s) => s.list)
  const text = (field: string) => (typeof play.place[field] === 'string' ? String(play.place[field]) : '')
  const actions = parseActions(text('Actions'))
  const decisions = parseDecisions(text('Decisions'))
  const nameOf = (id: string | null) => (id ? (agents.find((a) => a.id === id)?.name ?? id) : null)
  return (
    <>
      <Section label="Actions" empty={!actions.length}>
        {actions.map((a, i) => (
          <Row key={i} tag="A" title={a.attempt} chip={`${a.needs} · ${a.checks.length}`} items={actionItems(play, a, i)} />
        ))}
      </Section>
      <Section label="Decisions" empty={!decisions.length}>
        {decisions.map((d, i) => (
          <Row key={i} tag="D" purple title={d.question} chip={`${nameOf(d.decider) ?? 'you'} · ${d.options.length}`} items={decisionItems(play, d, i, nameOf(d.decider))} />
        ))}
      </Section>
    </>
  )
}
