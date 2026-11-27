import type { MapThing } from './registry'

export function OffMarks({ things }: { things: MapThing[] }) {
  return (
    <span className="pointer-events-none absolute inset-0 z-[33]">
      {things.map((t) => (
        <span
          key={t.key}
          title={`${t.label}: its layer is off`}
          style={{ left: t.bounds.x, top: t.bounds.y, width: t.bounds.w, height: t.bounds.h }}
          className="absolute bg-[repeating-linear-gradient(45deg,color-mix(in_srgb,var(--color-shade)_55%,transparent)_0_6px,transparent_6px_12px)] outline-dashed outline-1 outline-faint"
        />
      ))}
    </span>
  )
}
