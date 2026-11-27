import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, CopyPlus, ImageOff, ImagePlus, Images, Plus, Trash2 } from 'lucide-react'
import { frameMedia, frameText, normalizeFrame, type FrameEntry } from '@shared/settingSpec'
import { cn } from '../../../lib/cn'
import { AssetMedia } from '../../pictures/AssetMedia'
import { MEDIA_OPTIONS } from '../../pictures/mediaOptions'
import { usePicturePick } from '../../pictures/usePicturePick'
import { CardStack, Field, IconActions, RowAction, Textarea, moved, openMenu, type MenuItem } from '../../ui'
import { registerSettingControl, type SettingControlProps } from '../controls'

function FrameFace({ entry, index, front, tools, onText }: { entry: FrameEntry; index: number; front: boolean; tools: ReactNode; onText: (text: string) => void }) {
  const text = frameText(entry)
  const media = frameMedia(entry)
  return (
    <div className={cn('flex flex-col border tone-panel-75', front ? 'border-accent shadow-[0_0_14px_color-mix(in_srgb,var(--color-accent)_calc(22%*var(--glow)),transparent)]' : 'border-line')}>
      <div className="flex h-7 items-center gap-1 pl-2 pr-1">
        <span className="font-data text-[10.5px] text-faint">{index + 1}</span>
        {front && <span className="ml-auto opacity-0 transition-opacity focus-within:opacity-100 group-hover/card:opacity-100 touch:opacity-100">{tools}</span>}
      </div>
      {media && <AssetMedia id={media} className="max-h-36 w-full object-contain px-2 pb-1.5" />}
      <Textarea
        mono
        value={text}
        rows={Math.min(8, Math.max(2, text.split('\n').length))}
        spellCheck={false}
        placeholder={media ? 'Caption' : 'Frame'}
        onChange={(e) => onText(e.target.value)}
        className="min-h-0 resize-none whitespace-pre border-0 text-center leading-snug"
      />
    </div>
  )
}

function FramesControl({ spec, value, onChange }: SettingControlProps) {
  const frames = (Array.isArray(value) ? value : []) as FrameEntry[]
  const minFrames = Array.isArray(spec.default) && !spec.default.length ? 0 : 1
  const [at, setAt] = useState(0)
  const current = Math.max(0, Math.min(at, frames.length - 1))
  const target = useRef(current)

  const write = (next: FrameEntry[], focus: number) => {
    onChange(next)
    setAt(Math.max(0, Math.min(focus, next.length - 1)))
  }
  const update = (i: number, entry: FrameEntry) => onChange(frames.map((f, j) => (j === i ? entry : f)))
  const pick = usePicturePick(frames.length ? frameMedia(frames[current]) || null : null, (id) => update(target.current, normalizeFrame(frameText(frames[target.current] ?? ''), id ?? '')), MEDIA_OPTIONS)
  const onFrame = (i: number, run: () => void) => () => {
    target.current = i
    run()
  }

  const add = () => write([...frames.slice(0, current + 1), '', ...frames.slice(current + 1)], frames.length ? current + 1 : 0)
  const remove = (i: number) => write(frames.filter((_, j) => j !== i), i)
  const actions = (i: number): MenuItem[] => [
    { label: 'Picture from Seven', icon: <Images />, onSelect: onFrame(i, pick.fromSeven) },
    { label: 'Picture from disk', icon: <ImagePlus />, onSelect: onFrame(i, pick.fromDisk) },
    { label: 'Remove picture', icon: <ImageOff />, disabled: !frameMedia(frames[i]), onSelect: () => update(i, normalizeFrame(frameText(frames[i]), '')) },
    { label: '', separator: true },
    { label: 'Duplicate', icon: <CopyPlus />, onSelect: () => write([...frames.slice(0, i + 1), frames[i], ...frames.slice(i + 1)], i + 1) },
    { label: 'Move earlier', icon: <ArrowLeft />, disabled: i === 0, onSelect: () => write(moved(frames, i, i - 1), i - 1) },
    { label: 'Move later', icon: <ArrowRight />, disabled: i === frames.length - 1, onSelect: () => write(moved(frames, i, i + 1), i + 1) },
    { label: '', separator: true },
    { label: 'Delete frame', icon: <Trash2 />, hint: 'Del', danger: true, disabled: frames.length <= minFrames, onSelect: () => remove(i) }
  ]
  const keys = (e: KeyboardEvent<HTMLDivElement>) => {
    const run = [
      { key: 'Delete', ok: frames.length > minFrames, act: () => remove(current) },
      { key: 'Insert', ok: true, act: add }
    ].find((k) => k.key === e.key && k.ok)
    if (!run) return
    e.preventDefault()
    run.act()
  }

  return (
    <Field
      group
      label={spec.label}
      hint={spec.hint}
      aside={
        <span className="flex items-center gap-0.5">
          {frames.length > 0 && (
            <>
              <RowAction title="Previous frame (Left)" icon={<ChevronLeft />} disabled={current === 0} onClick={() => setAt(current - 1)} />
              <span className="min-w-9 text-center font-data text-[11px] text-dim">
                {current + 1}/{frames.length}
              </span>
              <RowAction title="Next frame (Right)" icon={<ChevronRight />} disabled={current === frames.length - 1} onClick={() => setAt(current + 1)} />
            </>
          )}
          <RowAction title="Add frame (Insert)" icon={<Plus />} onClick={add} />
        </span>
      }
    >
      {frames.length ? (
        <CardStack
          count={frames.length}
          current={current}
          onCurrent={setAt}
          label={(i) => `Frame ${i + 1}`}
          onMenu={(e, i) => openMenu(e, `Frame ${i + 1}`, actions(i))}
          onKeyDown={keys}
          card={(i, front) => <FrameFace entry={frames[i]} index={i} front={front} tools={front && <IconActions items={actions(i)} />} onText={(text) => update(i, normalizeFrame(text, frameMedia(frames[i])))} />}
        />
      ) : (
        <button type="button" onClick={add} className="mx-auto flex h-24 w-full max-w-sm items-center justify-center gap-1.5 border border-dashed border-line font-label text-[11px] caps-10 text-dim hover:border-accent hover:text-accent">
          <Plus className="h-3.5 w-3.5" />
          Frame
        </button>
      )}
    </Field>
  )
}

registerSettingControl('frames', FramesControl, { wide: true })
