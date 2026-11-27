import { useRef, useState } from 'react'
import type { AssetMeta, WidgetSource } from '@shared/types'
import { AssetCard, Gallery } from './AssetView'
import { PageFrame, isPage } from './PageFrame'
import { Field } from '../ui'
import { useData } from '../../store/data'
import { MissingWidget, type WidgetBodyProps, type WidgetEditorProps, type WidgetUi } from '../../registries/widgets'
import { noteFailure } from '../../store/problems'

const idsOf = (source: WidgetSource): string[] => (Array.isArray(source.assetIds) ? source.assetIds.map(String) : [])

function urlOf(a: AssetMeta): string {
  return `seven-asset://${a.id}/${encodeURIComponent(a.file)}`
}

function Player({ assets }: { assets: AssetMeta[] }) {
  const [index, setIndex] = useState(0)
  const audio = useRef<HTMLAudioElement>(null)
  const current = assets[Math.min(index, assets.length - 1)]
  const play = (i: number) => {
    setIndex(i)
    setTimeout(() => void audio.current?.play().catch(noteFailure('files', 'Could not play the audio')), 0)
  }
  return (
    <div className="flex h-full flex-col gap-2">
      <audio ref={audio} src={urlOf(current)} controls className="w-full shrink-0" onEnded={() => index + 1 < assets.length && play(index + 1)} />
      {assets.length > 1 && (
        <ol className="min-h-0 flex-1 overflow-y-auto font-ui text-[12px]">
          {assets.map((a, i) => (
            <li key={a.id}>
              <button
                onClick={() => play(i)}
                className={`w-full truncate px-2 py-1 text-left ${i === index ? 'bg-accent/10 text-accent' : 'text-ink/80 hover:bg-ink/[0.04]'}`}
              >
                {i + 1}. {a.name}
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function FileWidgetBody({ widget }: WidgetBodyProps) {
  const known = useData((s) => s.assets)
  const assets = idsOf(widget.source).map((id) => known.find((a) => a.id === id)).filter((a) => a !== undefined)
  if (!assets.length) return <MissingWidget what="files" />
  const images = assets.filter((a) => a.kind === 'image')
  if (widget.view === 'gallery' && images.length) return <Gallery assets={images} />
  if (widget.view === 'auto') {
    const only = (k: string) => assets.every((a) => a.kind === k)
    if (only('image') && assets.length > 1) return <Gallery assets={images} />
    if (only('audio')) return <Player assets={assets} />
    if (assets.length === 1 && assets[0].kind === 'video')
      return <video src={urlOf(assets[0])} controls className="min-h-0 flex-1 h-full w-full bg-panel object-contain" />
    if (assets.length === 1 && isPage(assets[0])) return <PageFrame asset={assets[0]} className="min-h-0 flex-1 h-full w-full" />
    if (assets.length === 1 && assets[0].kind === 'pdf')
      return <iframe src={urlOf(assets[0])} title={assets[0].name} className="min-h-0 flex-1 h-full w-full border-0 bg-page" />
  }
  if (assets.length === 1 && assets[0].kind === 'image')
    return (
      <div className="flex min-h-0 flex-1 h-full w-full items-center justify-center overflow-hidden">
        <img
          src={`seven-asset://${assets[0].id}/${encodeURIComponent(assets[0].file)}`}
          alt={assets[0].name}
          className="max-h-full max-w-full h-full w-full object-contain"
        />
      </div>
    )
  return (
    <div className="flex flex-col gap-3">
      {assets.map((a) => (
        <AssetCard key={a.id} asset={a} />
      ))}
    </div>
  )
}

function FileWidgetEditor({ source, onChange }: WidgetEditorProps) {
  const assets = useData((s) => s.assets)
  const ids = idsOf(source)
  const toggle = (id: string, on: boolean) => onChange({ ...source, assetIds: on ? [...ids, id] : ids.filter((x) => x !== id) })
  return (
    <Field label="Files">
      <div className="flex max-h-48 flex-col gap-1 overflow-y-auto border border-line/40 tone-panel-40 p-1.5">
        {assets.length === 0 && <span className="text-[12.5px] text-dim">No files yet. Add some in Data.</span>}
        {assets.map((a) => (
          <label key={a.id} className="flex cursor-pointer items-center gap-2 px-1 py-0.5 text-[12.5px] hover:bg-ink/5">
            <input type="checkbox" checked={ids.includes(a.id)} onChange={(e) => toggle(a.id, e.target.checked)} className="accent-[var(--color-accent)]" />
            <span className="truncate text-ink/90">{a.name}</span>
            <span className="ml-auto font-ui text-[10.5px] text-faint">{a.kind}</span>
          </label>
        ))}
      </div>
    </Field>
  )
}

export const FILE_WIDGET_UI: WidgetUi = {
  Body: FileWidgetBody,
  Editor: FileWidgetEditor,
  blank: () => ({ kind: 'file', assetIds: [] }),
  entry: (source) => {
    const ids = idsOf(source)
    return ids.length === 1 ? `file/${ids[0]}` : null
  }
}
