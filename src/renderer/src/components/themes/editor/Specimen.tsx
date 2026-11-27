import { useState } from 'react'
import { Button, Input, Panel, ShellFace, ShellTabs, StatusBadge, Toggle } from '../../ui'

export function Specimen() {
  const [tab, setTab] = useState<'open' | 'other'>('open')
  const [on, setOn] = useState(true)
  return (
    <aside className="hidden w-[22rem] shrink-0 flex-col gap-3 overflow-y-auto pr-1 xl:flex">
      <Panel title="Specimen" meta="live" bodyClassName="flex flex-col gap-3 p-3">
        <span className="type-eyebrow text-accent">Eyebrow</span>
        <span className="type-heading text-ink">View heading</span>
        <span className="type-title text-ink">Panel title</span>
        <p className="font-body text-[13.5px] leading-relaxed text-ink">
          Reading text, as in messages and pages. <span className="text-dim">Dim text for second lines,</span> <span className="text-faint">faint text for hints.</span>
        </p>
        <span className="flex items-baseline justify-between">
          <span className="type-label text-dim">Field label</span>
          <span className="type-data text-ink">1,284.50 · 07:45</span>
        </span>
        <Input placeholder="A field" />
        <ShellTabs
          value={tab}
          options={[
            { value: 'open', label: 'Active' },
            { value: 'other', label: 'Other' }
          ]}
          onChange={setTab}
        />
        <span className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="primary">
            Primary
          </Button>
          <Button size="sm" variant="secondary">
            Second
          </Button>
          <Button size="sm" variant="ghost">
            Quiet
          </Button>
          <Toggle checked={on} onChange={setOn} />
        </span>
        <span className="flex flex-wrap gap-2">
          <StatusBadge tone="ok">Done</StatusBadge>
          <StatusBadge tone="warn">Waiting</StatusBadge>
          <StatusBadge tone="error">Failed</StatusBadge>
        </span>
      </Panel>
      <div className="prose-doc border border-line/50 tone-panel-60 px-4 py-3">
        <h1>A page heading</h1>
        <p>Pages and documents read like this, with a rule between parts.</p>
        <h2>A section</h2>
        <hr />
      </div>
      <div className="card-deks p-3 text-[12.5px] text-dim">Hover this card</div>
      <ShellFace title="A card" label="Card" body="Cards, tiles and faces use the same surfaces and lines." stats={[{ key: 'a', label: 'Cost', value: '3' }, { key: 'b', label: 'Range', value: '12' }]} foot="Seven" />
    </aside>
  )
}
