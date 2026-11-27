import type { MapThing } from './registry'

export function SelectionRings({ things }: { things: MapThing[] }) {
  return (
    <span className="pointer-events-none absolute inset-0 z-[35]">
      {things.map((t) => (
        <span
          key={t.key}
          style={{ left: t.bounds.x, top: t.bounds.y, width: t.bounds.w, height: t.bounds.h }}
          className="absolute outline-dashed outline-2 outline-offset-2 outline-accent"
        />
      ))}
    </span>
  )
}
