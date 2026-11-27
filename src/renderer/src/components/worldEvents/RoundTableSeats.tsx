import type { TableSeat } from './seats'
import { Seat, useSeatName } from './Seat'

function PlacedSeat({ seat, index, count, speaker, factionName }: { seat: TableSeat; index: number; count: number; speaker: string | null; factionName: (id: string) => string }) {
  const name = useSeatName(seat, factionName)
  const angle = (index / Math.max(1, count)) * 2 * Math.PI - Math.PI / 2
  const lower = name.toLowerCase()
  const speaking = Boolean(speaker && (lower === speaker || lower.startsWith(`${speaker} `) || speaker.startsWith(`${lower} `)))
  return <Seat seat={seat} name={name} factionName={factionName} speaking={speaking} x={50 + 40 * Math.cos(angle)} y={50 + 40 * Math.sin(angle)} />
}

export function RoundTableSeats({ seats, speaker, factionName, title }: { seats: TableSeat[]; speaker: string | null; factionName: (id: string) => string; title: string }) {
  return (
    <div className="relative aspect-square w-full max-w-[520px]">
      <div className="absolute inset-[22%] flex items-center justify-center rounded-full border border-accent/40 tone-panel-60 p-4 text-center shadow-[inset_0_0_40px_color-mix(in_srgb,var(--color-accent)_calc(12%*var(--glow)),transparent)]">
        <span className="font-label text-[13px] caps-10 text-accent">{title}</span>
      </div>
      {seats.map((s, i) => (
        <PlacedSeat key={s.key} seat={s} index={i} count={seats.length} speaker={speaker?.toLowerCase() ?? null} factionName={factionName} />
      ))}
    </div>
  )
}
