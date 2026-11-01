import { useEffect, useState } from 'react'
import { SquareDashedMousePointer, Trash2 } from 'lucide-react'
import type { AssetMeta, PictureArea } from '@shared/types'
import { shapeBounds, type Shape } from '@shared/shapes'
import { Button, Eyebrow, Input, SaveState, useDraft } from '../ui'
import { MarkdownEditor } from '../data/MarkdownEditor'
import { PICTURE_SPACE, areaShape } from './AreaLayer'
import { ShapeEditor } from '../shapes/ShapeEditor'
import { AssetPreview } from '../data/AssetView'
import { assetUrl } from '../../store/data'
import { engine } from '../../lib/ipc'
import { cn } from '../../lib/cn'

const NEW_AREA = 'New area'

function AgentReads({ asset }: { asset: AssetMeta }) {
  const [text, setText] = useState('')
  const key = JSON.stringify([asset.description, asset.areas])
  useEffect(() => {
    let live = true
    engine('library.read', { entry: `@file:${asset.id}` })
      .then((t) => live && setText(t))
      .catch(() => live && setText(''))
    return () => {
      live = false
    }
  }, [asset.id, key])
  if (!text) return null
  return (
    <pre className="whitespace-pre-wrap border border-dashed border-cyan/35 px-2.5 py-2 font-mono text-[11px] leading-relaxed text-cyan/85">
      {text}
    </pre>
  )
}

export function FileEditor({ asset }: { asset: AssetMeta }) {
  const picture = asset.kind === 'image'
  const source = { description: asset.description ?? '', areas: asset.areas ?? [] }
  const { draft, change, status, error } = useDraft(source, (v) =>
    engine('data.assets.describe', { id: asset.id, description: v.description, areas: v.areas })
  )
  const [marking, setMarking] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const setArea = (id: string, patch: Partial<PictureArea>) =>
    change((d) => ({ ...d, areas: d.areas.map((a) => (a.id === id ? { ...a, ...patch } : a)) }))
  const remove = (id: string) =>
    change((d) => ({ ...d, areas: d.areas.filter((a) => a.id !== id) }))
  const shapes = draft.areas.map((a) => areaShape(a, a.name || NEW_AREA))
  const setShapes = (next: Shape[]) =>
    change((d) => ({
      ...d,
      areas: next.map((s) => ({ ...(d.areas.find((a) => a.id === s.id) ?? { id: s.id, name: '', note: '' }), ...shapeBounds(s.form) }))
    }))

  return (
    <div className="grid min-h-0 gap-4 lg:grid-cols-[1fr_320px]">
      {!picture ? (
        <div className="flex min-w-0 flex-col gap-2">
          <AssetPreview asset={asset} large />
          <SaveState status={status} error={error} />
        </div>
      ) : (
        <div className="flex min-w-0 flex-col items-start gap-2">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={marking ? 'primary' : 'badge'}
              icon={<SquareDashedMousePointer />}
              onClick={() => setMarking(!marking)}
            >
              {marking ? 'Drag on the picture' : 'Mark an area'}
            </Button>
            <SaveState status={status} error={error} />
          </div>
          <ShapeEditor
            size={PICTURE_SPACE}
            shapes={shapes}
            onChange={setShapes}
            selected={selected}
            onSelect={setSelected}
            drawing={marking ? 'box' : null}
            onDrawn={() => setMarking(false)}
            newLabel={NEW_AREA}
            className="max-w-full border border-line/40"
          >
            <img
              src={assetUrl(asset)}
              alt={asset.name}
              draggable={false}
              className="block max-h-[70vh] w-auto max-w-full"
            />
          </ShapeEditor>
        </div>
      )}
      <div className="flex min-w-0 flex-col gap-4 border-line/50 lg:border-l lg:pl-4">
        <div className="flex flex-col gap-1.5">
          <Eyebrow>Description</Eyebrow>
          <MarkdownEditor
            compact
            value={draft.description}
            placeholder={
              picture
                ? "What's in the picture. Agents can't see pictures, so this is what they know."
                : 'What this file is, for agents and search.'
            }
            onValue={(description) => change((d) => ({ ...d, description }))}
          />
        </div>
        {picture && (
          <div className="flex flex-col gap-1.5">
            <Eyebrow>Areas</Eyebrow>
            {!draft.areas.length && (
              <span className="text-[12px] text-faint">
                Mark an area and drag a box on the picture. Named areas can be clicked when an agent
                shows it.
              </span>
            )}
            {draft.areas.map((a) => (
              <div
                key={a.id}
                onClick={() => setSelected(a.id)}
                className={cn(
                  'flex flex-col gap-1 border bg-black/45 p-2',
                  a.id === selected ? 'border-cyan' : 'border-line/40'
                )}
              >
                <div className="flex items-center gap-1.5">
                  <Input
                    autoFocus={a.id === selected && !a.name}
                    value={a.name}
                    placeholder="Name this area"
                    onChange={(e) => setArea(a.id, { name: e.target.value })}
                    className="h-7 flex-1 font-mono text-[12px] uppercase"
                  />
                  <button
                    type="button"
                    title="Remove this area"
                    onClick={() => remove(a.id)}
                    className="p-1 text-faint hover:text-alert"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <Input
                  value={a.note}
                  placeholder="What is it?"
                  onChange={(e) => setArea(a.id, { note: e.target.value })}
                  className="h-7 text-[12px]"
                />
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Eyebrow className="text-cyan/80">What the agent reads</Eyebrow>
          <AgentReads asset={asset} />
        </div>
      </div>
    </div>
  )
}
