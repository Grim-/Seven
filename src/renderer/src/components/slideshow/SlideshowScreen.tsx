import type { MouseEvent } from 'react'
import { ImageIcon, PanelRight, Play, Plus } from 'lucide-react'
import type { SlideshowData } from '@shared/slideshow'
import { showName } from '@shared/ids'
import type { Backdrop } from '@shared/types'
import { Button, DropOverlay, EmptyState, EntryHeader, Field, NumberField, SaveState, Segmented, moved, openMenu, useDraft, useReorder, type MenuItem } from '../ui'
import { useData, type DataSelection } from '../../store/data'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { toast } from '../../store/toasts'
import { importPaths, onlyKinds } from '../../lib/importFiles'
import { useFileDrop } from '../../lib/useFileDrop'
import { focusedConversation } from '../../lib/conversation'
import type { KindScreenProps } from '../../registries/kinds'
import { entryMenuAt } from '../../views/data/entryMenu'
import { showInPanel } from '../data/showInPanel'
import { boardMenu } from '../data/boardMenu'
import { pickPictures } from '../data/PicturePicker'
import { BACKDROP_DIM, BACKDROP_SCOPES, setBackdrop, type BackdropScope } from '../backdrop/backdropActions'
import { PictureGrid } from '../pictures/PictureGrid'
import { newSlideshow } from './slideshowActions'
import { playSlideshow, useSlideshow } from './useSlideshow'
import { openEntry } from '../../lib/library'

export function askNewSlideshow(select: (s: DataSelection | null) => void): void {
  newSlideshow([], (s) => select({ kind: 'slideshow', id: s.id }))
}

function backdropMenu(id: string): MenuItem[] {
  const backdrop: Backdrop = { colors: [], image: null, slideshow: id, dim: BACKDROP_DIM }
  const sessionId = focusedConversation()?.sessionId ?? null
  const scopes: BackdropScope[] = sessionId ? ['chat', 'chats', 'app'] : ['chats', 'app']
  return scopes.map((scope) => ({
    label: BACKDROP_SCOPES[scope],
    onSelect: () =>
      void setBackdrop(scope, backdrop, sessionId).then(() => toast.success('Background set', `${BACKDROP_SCOPES[scope]}. Change how dark it is from the Background button in a chat.`), failed('Could not set it'))
  }))
}

const ORDER = [
  { value: 'order', label: 'In order' },
  { value: 'shuffle', label: 'Shuffle' }
] as const
const FIT = [
  { value: 'contain', label: 'Whole picture' },
  { value: 'cover', label: 'Fill' }
] as const
const CAPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'on', label: 'File name' }
] as const

export function SlideshowScreen({ id }: KindScreenProps) {
  const show = useSlideshow(id)
  if (!id) return null
  if (show === undefined) return <div className="font-ui text-[11px] text-dim">Loading…</div>
  if (!show) return <EmptyState title="Gone">This slideshow no longer exists.</EmptyState>
  const { id: showId, title, updatedAt: _updatedAt, ...data } = show
  return <SlideshowEditor key={showId} id={showId} title={title} source={data} />
}

function SlideshowEditor({ id, title, source }: { id: string; title: string; source: SlideshowData }) {
  const assets = useData((s) => s.assets)
  const { draft, change, status, error } = useDraft<SlideshowData>(source, (d) => engine('slideshows.save', { id, title, data: d }))
  const reorder = useReorder((from, to) => change({ ...draft, pictures: moved(draft.pictures, from, to) }))
  const add = (ids: string[]) => change({ ...draft, pictures: [...draft.pictures, ...ids.filter((x) => !draft.pictures.includes(x))] })
  const drop = useFileDrop((paths) => void importPaths(paths).then((added) => add(onlyKinds(added, ['image'], 'pictures').map((a) => a.id))))
  const remove = (pic: string) => change({ ...draft, pictures: draft.pictures.filter((x) => x !== pic) })
  const pictureMenu = (e: MouseEvent, pic: string) =>
    openMenu(e, assets.find((a) => a.id === pic)?.name ?? 'Picture', [
      { label: 'Open', onSelect: () => openEntry('file', pic) },
      { label: 'Take out of the slideshow', danger: true, onSelect: () => remove(pic) }
    ])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
      <EntryHeader title={showName(title)} kind={`Slideshow · ${draft.pictures.length} pictures`} onMenu={(e) => entryMenuAt(e, 'slideshow', id, title)}>
        <SaveState status={status} error={error} />
        <Button size="sm" variant="primary" icon={<Play />} disabled={!draft.pictures.length} onClick={() => playSlideshow(id)}>
          Play
        </Button>
        <Button size="sm" variant="ghost" icon={<PanelRight />} onClick={() => void showInPanel(`slideshow/${id}`, 'show')}>
          Show in side panel
        </Button>
        <Button size="sm" variant="ghost" onClick={(e) => openMenu(e, 'Put on a board', [boardMenu(`slideshow/${id}`)])}>
          Put on a board
        </Button>
        <Button size="sm" variant="ghost" icon={<ImageIcon />} onClick={(e) => openMenu(e, 'Use as the background for', backdropMenu(id))}>
          Use as background
        </Button>
      </EntryHeader>
      <div className="grid min-h-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div {...drop.props} className="relative flex flex-col gap-2">
          <PictureGrid ids={draft.pictures} min="9rem" wide reorder={reorder} onPick={(pic) => openEntry('file', pic)} onMenu={pictureMenu}>
            <button onClick={() => void pickPictures().then((ids) => ids.length && add(ids))} className="flex aspect-[4/3] items-center justify-center gap-1 border border-dashed border-line/60 text-[12px] text-faint hover:border-accent/60 hover:text-accent">
              <Plus className="h-4 w-4" /> Add pictures
            </button>
          </PictureGrid>
          <span className="text-[11.5px] text-faint">Drag to reorder. Right-click a picture to take it out. Dropping pictures here adds them to Files and to the slideshow.</span>
          <DropOverlay show={drop.over} label="Add to the slideshow" />
        </div>
        <div className="flex flex-col gap-3">
          <Field label="Each picture">
            <div className="flex items-center gap-2">
              <NumberField value={draft.seconds} step={0.5} onChange={(v) => v !== undefined && v > 0 && change({ ...draft, seconds: v })} className="w-24" />
              <span className="text-[12px] text-dim">seconds</span>
            </div>
          </Field>
          <Field label="Order">
            <Segmented value={draft.shuffle ? 'shuffle' : 'order'} options={[...ORDER]} onChange={(v) => change({ ...draft, shuffle: v === 'shuffle' })} />
          </Field>
          <Field label="Fit">
            <Segmented value={draft.fit} options={[...FIT]} onChange={(v) => change({ ...draft, fit: v })} />
          </Field>
          <Field label="Captions">
            <Segmented value={draft.captions ? 'on' : 'off'} options={[...CAPTIONS]} onChange={(v) => change({ ...draft, captions: v === 'on' })} />
          </Field>
        </div>
      </div>
    </div>
  )
}
