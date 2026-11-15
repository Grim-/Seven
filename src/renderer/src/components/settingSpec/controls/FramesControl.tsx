import { Plus, X } from 'lucide-react'
import { Button, Field, Textarea } from '../../ui'
import { registerSettingControl, type SettingControlProps } from '../controls'

function FramesControl({ spec, value, onChange }: SettingControlProps) {
  const frames = Array.isArray(value) ? value : []
  return (
    <Field label={`${spec.label} (${frames.length})`} hint={spec.hint}>
      <div className="flex flex-col gap-1">
        {frames.map((frame, i) => (
          <div key={i} className="flex items-start gap-1">
            <Textarea value={frame} rows={Math.max(1, frame.split('\n').length)} spellCheck={false} onChange={(e) => onChange(frames.map((f, j) => (j === i ? e.target.value : f)))} className="min-h-0 flex-1 whitespace-pre font-mono text-[12px]" />
            <button type="button" title="Remove frame" disabled={frames.length < 2} onClick={() => onChange(frames.filter((_, j) => j !== i))} className="mt-1.5 text-faint hover:text-alert disabled:opacity-30">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => onChange([...frames, frames.at(-1) ?? ''])} className="self-start">
          Frame
        </Button>
      </div>
    </Field>
  )
}

registerSettingControl('frames', FramesControl, { wide: true })
