import { useMemo, useState } from 'react'
import { create } from 'zustand'
import type { AssetMeta, ImagePromptContext } from '@shared/types'
import { Aperture, ImagePlus, Trash2 } from 'lucide-react'
import { Button, EmptyState, Modal, SearchBox } from '../ui'
import { useData } from '../../store/data'
import { choosePictures, fitsFile } from '../../lib/importFiles'
import { mergeImageContexts, useActiveImageContext } from '../../lib/imagePromptContext'
import { PictureGrid } from '../pictures/PictureGrid'
import { generateImage } from '../pictures/GenerateImageModal'

export type PictureChoice = { id: string | null } | null

export interface PictureOptions {
  kinds?: AssetMeta['kind'][]
  mimes?: string[]
  what?: string
  context?: ImagePromptContext | null
}

interface PickRequest {
  multiple: boolean
  current: string | null
  kinds: AssetMeta['kind'][]
  mimes?: string[]
  what: string
  context?: ImagePromptContext | null
  done: (ids: string[] | null) => void
}

const usePicker = create<{ request: PickRequest | null }>(() => ({ request: null }))

function ask(request: Omit<PickRequest, 'done'>): Promise<string[] | null> {
  return new Promise((resolve) => usePicker.setState({ request: { ...request, done: resolve } }))
}

export async function pickPicture(current: string | null, options: PictureOptions = {}): Promise<PictureChoice> {
  const ids = await ask({ multiple: false, current, kinds: options.kinds ?? ['image'], mimes: options.mimes, what: options.what ?? 'a picture', context: options.context })
  return ids ? { id: ids[0] ?? null } : null
}

export async function pickPictures(options: PictureOptions = {}): Promise<string[]> {
  return (await ask({ multiple: true, current: null, kinds: options.kinds ?? ['image'], mimes: options.mimes, what: options.what ?? 'pictures', context: options.context })) ?? []
}

function PicturePicker({ request }: { request: PickRequest }) {
  const { multiple, current, kinds, mimes, what } = request
  const activeContext = useActiveImageContext()
  const context = useMemo(() => mergeImageContexts(request.context, activeContext), [request.context, activeContext])
  const assets = useData((s) => s.assets)
  const [query, setQuery] = useState('')
  const images = useMemo(() => {
    const q = query.trim().toLowerCase()
    return assets
      .filter((a) => fitsFile(a, kinds, mimes) && (!q || a.name.toLowerCase().includes(q)))
      .map((a) => a.id)
  }, [assets, kinds, mimes, query])
  const [chosen, setChosen] = useState<string[]>([])
  const finish = (ids: string[] | null) => {
    usePicker.setState({ request: null })
    request.done(ids)
  }
  const pick = (ids: string[]) => {
    if (ids.length) finish(multiple ? ids : ids.slice(0, 1))
  }
  const fromDisk = async () => pick((await choosePictures(kinds, multiple, what, mimes)).map((a) => a.id))
  const canGenerate = kinds.includes('image')
  const fromGenerate = async () => {
    const asset = await generateImage({ title: `Generate ${what}`, context })
    if (asset && fitsFile(asset, kinds, mimes)) pick([asset.id])
  }
  const click = (id: string) => (multiple ? setChosen(chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id]) : pick([id]))
  return (
    <Modal
      open
      width={980}
      title={`Choose ${what}`}
      onClose={() => finish(null)}
      footer={
        <>
          <Button size="sm" variant="secondary" icon={<ImagePlus />} onClick={() => void fromDisk()}>
            Upload
          </Button>
          {canGenerate && (
            <Button size="sm" variant="secondary" icon={<Aperture />} onClick={() => void fromGenerate()}>
              Generate
            </Button>
          )}
          {current && !multiple && (
            <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={() => finish([])}>
              Clear
            </Button>
          )}
          <span className="flex-1" />
          <Button size="sm" variant="ghost" onClick={() => finish(null)}>
            Cancel
          </Button>
          {multiple && (
            <Button size="sm" variant="primary" disabled={!chosen.length} onClick={() => pick(chosen)}>
              Add {chosen.length || ''}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <SearchBox value={query} onChange={setQuery} placeholder="Filter images by name…" />
        {images.length ? (
          <PictureGrid
            ids={images}
            min="9.5rem"
            names
            isOn={(id) => (multiple ? chosen.includes(id) : id === current)}
            onPick={click}
            className="max-h-[66vh] overflow-y-auto pr-1"
          />
        ) : (
          <EmptyState title={query.trim() ? `No pictures matching "${query.trim()}"` : `No ${mimes ? `${mimes.map((m) => m.split('/')[1].toUpperCase()).join(', ')} ` : ''}pictures yet`}>
            {query.trim() ? 'Try a different filter.' : 'Upload from disk or generate one.'}
          </EmptyState>
        )}
      </div>
    </Modal>
  )
}

export function PicturePickerHost() {
  const request = usePicker((s) => s.request)
  return request ? <PicturePicker request={request} /> : null
}
