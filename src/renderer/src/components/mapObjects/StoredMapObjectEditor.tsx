import { useMemo } from 'react'
import type { StoredMapObject } from '@shared/game/mapObjects'
import { Field, Input, Segmented, TagInput } from '../ui'
import { MapObjectGraphicPicker } from '../game/MapObjectGraphicPicker'
import { EntrySelect } from '../game/EntrySelect'
import { ObjectPlayManager } from '../maps/ObjectPlayManager'
import { mapObjectImageContext, useRegisterImageContext } from '../../lib/imagePromptContext'
import { LinkTextarea } from '../data/LinkTextarea'

interface Props {
  value: StoredMapObject
  onChange: (next: StoredMapObject) => void
}

export function StoredMapObjectEditor({ value, onChange }: Props) {
  const objectContext = useMemo(
    () => mapObjectImageContext({ name: value.name, description: value.description, tags: value.tags }),
    [value.name, value.description, value.tags]
  )
  useRegisterImageContext(objectContext)
  return (
    <div className="flex flex-col gap-4 font-ui select-none">
      {/* NAME & COLLISION */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="NAME">
          <Input
            value={value.name}
            placeholder="e.g. Iron Chest, Wooden Door, Campfire..."
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            className="h-8 text-[13px]"
          />
        </Field>

        <Field label="COLLISION">
          <Segmented
            value={value.collision}
            options={[
              { value: 'solid', label: 'Solid (Blocks Movement)' },
              { value: 'passable', label: 'Passable (Walkable)' }
            ]}
            onChange={(collision) => onChange({ ...value, collision: collision as 'solid' | 'passable' })}
          />
        </Field>
      </div>

      {/* GRAPHIC / SPRITE PICKER */}
      <div className="border border-line/40 tone-panel-30 p-3">
        <div className="mb-2 font-label text-[10px] font-bold caps-5 text-secondary-ink">
          SPRITE GRAPHIC
        </div>
        <MapObjectGraphicPicker
          image={value.image}
          size={value.size}
          graphicSource={value.graphicSource}
          context={objectContext}
          onChange={(image, size, graphicSource) =>
            onChange({ ...value, image, size, graphicSource })
          }
        />
      </div>

      {/* LINKED ENTRY */}
      <Field label="LINKED ENTRY (PAGE / SHEET)">
        <EntrySelect
          value={value.entry ?? undefined}
          onChange={(entry) => onChange({ ...value, entry: entry ?? null })}
          placeholder="None (no linked document)"
        />
      </Field>

      {/* INTERACTIVE ACTIONS & DECISIONS */}
      <div className="border border-line/40 tone-panel-30 p-3">
        <ObjectPlayManager
          actionsText={value.actions}
          decisionsText={value.decisions}
          onChangeActions={(actions) => onChange({ ...value, actions })}
          onChangeDecisions={(decisions) => onChange({ ...value, decisions })}
        />
      </div>

      {/* DESCRIPTION */}
      <Field label="DESCRIPTION">
        <LinkTextarea rolls={false}
          value={value.description}
          placeholder="Object notes, lore, or inspection description..."
          rows={2}
          onValue={(v) => onChange({ ...value, description: v })}
        />
      </Field>

      {/* TAGS */}
      <Field label="TAGS">
        <TagInput
          value={value.tags}
          onChange={(tags) => onChange({ ...value, tags })}
        />
      </Field>
    </div>
  )
}
