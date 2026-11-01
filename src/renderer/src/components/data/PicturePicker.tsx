import { useMemo, useState } from 'react'
import { create } from 'zustand'
import type { AssetMeta } from '@shared/types'
import { ImagePlus, Trash2 } from 'lucide-react'
import { Button, EmptyState, Modal } from '../ui'
import { useData } from '../../store/data'
import { choosePictures, fitsFile } from '../../lib/importFiles'
import { PictureGrid } from '../pictures/PictureGrid'

export type PictureChoice = { id: string | null } | null

export interface PictureOptions {
  kinds?: AssetMeta['kind'][]
  mimes?: string[]
  what?: string
}

interface PickRequest {
  multiple: boolean
  current: string | null
  kinds: AssetMeta['kind'][]
  mimes?: string[]
  what: string
  done: (ids: string[] | null) => void
}

const usePicker = create<{ request: PickRequest | null }>(() => ({ request: null }))

function ask(request: Omit<PickRequest, 'done'>): Promise<string[] | null> {
  return new Promise((resolve) => usePicker.setState({ request: { ...request, done: resolve } }))
}

export async function pickPicture(current: string | null, options: PictureOptions = {}): Promise<PictureChoice> {
  const ids = await ask({ multiple: false, current, kinds: options.kinds ?? ['image'], mimes: options.mimes, what: options.what ?? 'a picture' })
  return ids ? { id: ids[0] ?? null } : null
}

export async function pickPictures(options: PictureOptions = {}): Promise<string[]> {
  return (await ask({ multiple: true, current: null, kinds: options.kinds ?? ['image'], mimes: options.mimes, what: options.what ?? 'pictures' })) ?? []
}

function PicturePicker({ request }: { request: PickRequest }) {
  const { multiple, current, kinds, mimes, what } = request
  const assets = useData((s) => s.assets)
  const images = useMemo(() => assets.filter((a) => fitsFile(a, kinds, mimes)).map((a) => a.id), [assets, kinds, mimes])
  const [chosen, setChosen] = useState<string[]>([])
  const finish = (ids: string[] | null) => {
    usePicker.setState({ request: null })
    request.done(ids)
  }
  const pick = (ids: string[]) => {
    if (ids.length) finish(multiple ? ids : ids.slice(0, 1))
  }
  const fromDisk = async () => pick((await choosePictures(kinds, multiple, what, mimes)).map((a) => a.id))
  const click = (id: string) => (multiple ? setChosen(chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id]) : pick([id]))
  return (
    <Modal
      open
      title={`Choose ${what}`}
      onClose={() => finish(null)}
      footer={
        <>
          <Button variant="ghost" icon={<ImagePlus />} onClick={() => void fromDisk()}>
            From disk…
          </Button>
          {current && !multiple && (
            <Button variant="ghost" icon={<Trash2 />} onClick={() => finish([])}>
              Remove picture
            </Button>
          )}
          <span className="flex-1" />
          <Button variant="ghost" onClick={() => finish(null)}>
            Cancel
          </Button>
          {multiple && (
            <Button variant="primary" disabled={!chosen.length} onClick={() => pick(chosen)}>
              Add {chosen.length || ''}
            </Button>
          )}
        </>
      }
    >
      {images.length ? (
        <PictureGrid ids={images} isOn={(id) => (multiple ? chosen.includes(id) : id === current)} onPick={click} className="max-h-[56vh] overflow-y-auto pr-1" />
      ) : (
        <EmptyState title={`No ${mimes ? `${mimes.map((m) => m.split('/')[1].toUpperCase()).join(', ')} ` : ''}pictures yet`}>Add some from disk.</EmptyState>
      )}
    </Modal>
  )
}

export function PicturePickerHost() {
  const request = usePicker((s) => s.request)
  return request ? <PicturePicker request={request} /> : null
}
