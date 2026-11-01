import { cn } from '../../lib/cn'

export type MeterTone = 'cool' | 'warm' | 'hot'

export const METER_TEXT: Record<MeterTone, string> = { cool: 'text-white/85', warm: 'text-accent', hot: 'text-alert' }

export function meterTone(value: number | null): MeterTone {
  return value !== null && value >= 0.9 ? 'hot' : value !== null && value >= 0.75 ? 'warm' : 'cool'
}

export function SegmentBar({ value, tone, segments = 24, thin = false, className }: { value: number; tone?: MeterTone; segments?: number; thin?: boolean; className?: string }) {
  const filled = Math.round(Math.max(0, Math.min(1, value)) * segments)
  return (
    <div className={cn('segment-bar', className)} data-tone={tone} data-thin={thin}>
      {Array.from({ length: segments }, (_, i) => (
        <i key={i} data-on={i < filled} />
      ))}
    </div>
  )
}

export function Meter({ label, value, text, note }: { label: string; value: number | null; text: string; note?: string }) {
  const tone = meterTone(value)
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-2 font-mono text-[10.5px] uppercase tracking-[0.16em]">
        <span className="text-faint">{label}</span>
        <span className={cn('ml-auto normal-case tabular-nums', METER_TEXT[tone])}>{text}</span>
      </div>
      {value !== null && <SegmentBar value={value} tone={tone} />}
      {note && <div className="text-[11px] text-faint">{note}</div>}
    </div>
  )
}
