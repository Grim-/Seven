import { useMemo } from 'react'
import type { DndFeature, DndStats } from '@shared/dnd'
import { RecordRows } from '../../../ui'
import { engine } from '../../../../lib/ipc'
import { failed } from '../../../../lib/notify'
import { useCompendiumList } from '../../../dnd/useCompendiumList'
import { CompendiumAdd } from './CompendiumAdd'
import { Section } from './Section'

export function Features({ dnd, onChange }: { dnd: DndStats; onChange: (patch: Partial<DndStats>) => void }) {
  const features = useCompendiumList('feature')
  const names = useMemo(() => {
    const words = [dnd.cls, dnd.race].flatMap((w) => w.toLowerCase().split(/\s+/)).filter((w) => w.length > 2)
    const mine = (from: unknown) => words.some((w) => String(from ?? '').toLowerCase().includes(w))
    return [...features.refs.filter((r) => mine(r.facts.from)), ...features.refs.filter((r) => !mine(r.facts.from))].map((r) => r.name)
  }, [features.refs, dnd.cls, dnd.race])
  const add = (name: string) => {
    const ref = features.find(name)
    if (!ref) return onChange({ features: [...dnd.features, { name, text: '' }] })
    void engine('dnd.get', { kind: 'feature', id: ref.id })
      .then(({ entry }) => onChange({ features: [...dnd.features, { name: entry.name, text: entry.text }] }))
      .catch(failed('Could not load that feature'))
  }
  return (
    <Section title="Features and traits">
      <RecordRows<DndFeature>
        dense
        rows={dnd.features}
        onChange={(next) => onChange({ features: next })}
        blank={() => ({ name: '', text: '' })}
        add={<CompendiumAdd label="Add feature" names={names} onAdd={add} />}
        columns={[{ key: 'name', label: 'Feature', width: '12rem', placeholder: 'Second Wind' }, { key: 'text', label: 'What it does', kind: 'long' }]}
      />
    </Section>
  )
}
