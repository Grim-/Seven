import { ImagePlus, Images, Plus, X } from 'lucide-react'
import { frameMedia, frameText, normalizeFrame, type FrameEntry } from '@shared/settingSpec'
import { AssetMedia } from '../../pictures/AssetMedia'
import { MEDIA_OPTIONS } from '../../pictures/mediaOptions'
import { usePicturePick } from '../../pictures/usePicturePick'
import { Button, Field, Textarea } from '../../ui'
import { registerSettingControl, type SettingControlProps } from '../controls'

function FrameCard({
  index,
  entry,
  canRemove,
  onUpdate,
  onRemove
}: {
  index: number
  entry: FrameEntry
  canRemove: boolean
  onUpdate: (next: FrameEntry) => void
  onRemove: () => void
}) {
  const text = frameText(entry)
  const media = frameMedia(entry)
  const { fromSeven, fromDisk } = usePicturePick(media || null, (id) => onUpdate(normalizeFrame(text, id ?? '')), MEDIA_OPTIONS)
  const lineCount = Math.min(4, Math.max(1, text.split('\n').length))

  return (
    <div className="flex min-w-[148px] max-w-[230px] flex-1 basis-[168px] flex-col gap-1.5 border border-line/70 bg-black/45 p-1.5">
      <div className="flex items-center justify-between gap-1">
        <span className="font-mono text-[9.5px] uppercase text-faint">#{index + 1}</span>
        <div className="flex items-center gap-0.5">
          {media ? (
            <>
              <button type="button" onClick={fromSeven} title="Change media clip from Seven" className="h-5 w-5 shrink-0 overflow-hidden border border-accent/60 bg-black hover:border-white">
                <AssetMedia id={media} className="h-full w-full object-cover" />
              </button>
              <button type="button" onClick={fromDisk} title="Pick media file from disk" className="px-1 text-dim hover:text-white">
                <ImagePlus className="h-3 w-3" />
              </button>
              <button type="button" onClick={() => onUpdate(normalizeFrame(text, ''))} title="Clear media on this frame" className="px-0.5 text-faint hover:text-alert">
                <X className="h-3 w-3" />
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={fromSeven} title="Attach image, GIF or video from Seven to this frame" className="flex items-center gap-0.5 px-1 text-faint hover:text-accent">
                <Images className="h-3 w-3" />
              </button>
              <button type="button" onClick={fromDisk} title="Attach media file from disk to this frame" className="px-0.5 text-faint hover:text-accent">
                <ImagePlus className="h-3 w-3" />
              </button>
            </>
          )}
          <button type="button" title="Remove frame" disabled={!canRemove} onClick={onRemove} className="ml-0.5 text-faint hover:text-alert disabled:opacity-25">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <Textarea
        value={text}
        rows={lineCount}
        placeholder={media ? 'Optional text...' : 'Frame text...'}
        spellCheck={false}
        onChange={(e) => onUpdate(normalizeFrame(e.target.value, media))}
        className="min-h-0 w-full resize-y whitespace-pre font-mono text-[11.5px] leading-snug"
      />
    </div>
  )
}

function FramesControl({ spec, value, onChange }: SettingControlProps) {
  const frames = (Array.isArray(value) ? value : []) as FrameEntry[]
  const minFrames = Array.isArray(spec.default) && !spec.default.length ? 0 : 1
  const add = () => {
    const last = frames.at(-1)
    onChange([...frames, last ?? '( • _ • )'])
  }
  return (
    <Field label={`${spec.label} (${frames.length})`} hint={spec.hint}>
      <div className="flex flex-wrap items-stretch gap-2">
        {frames.map((frame, i) => (
          <FrameCard
            key={i}
            index={i}
            entry={frame}
            canRemove={frames.length > minFrames}
            onUpdate={(next) => onChange(frames.map((f, j) => (j === i ? next : f)))}
            onRemove={() => onChange(frames.filter((_, j) => j !== i))}
          />
        ))}
        <Button size="sm" variant="ghost" icon={<Plus />} onClick={add} className="min-h-[52px] self-stretch border border-dashed border-line/60 px-3">
          Frame
        </Button>
      </div>
    </Field>
  )
}

registerSettingControl('frames', FramesControl, { wide: true })
