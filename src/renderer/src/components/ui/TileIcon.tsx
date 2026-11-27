import type { ReactNode } from 'react'

const OUTLINE = {
  folder: 'M5 11 H19 L23 15 H43 V39 H5 Z M5 19 H43',
  page: 'M11 5 H30 L37 12 V43 H11 Z M30 5 V12 H37',
  file: 'M11 5 H30 L37 12 V43 H11 Z M30 5 V12 H37'
}

const LINES = 'M17 22 H31 M17 27 H31 M17 32 H26'

export function TileIcon({ shape, label, glyph }: { shape: keyof typeof OUTLINE; label?: string; glyph?: ReactNode }) {
  return (
    <span className="relative inline-flex aspect-square w-[42%] items-center justify-center">
      <svg viewBox="0 0 48 48" className="absolute inset-0 h-full w-full" fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinejoin="miter" strokeLinecap="square">
        <path d={OUTLINE[shape]} />
        {shape === 'page' && !glyph && <path d={LINES} />}
        {label && (
          <text x="24" y="33" textAnchor="middle" fill="currentColor" stroke="none" className="font-ui" fontSize="7.5" letterSpacing="0.5">
            {label}
          </text>
        )}
      </svg>
      {glyph && <span className="relative mt-[16%] flex h-[30%] w-[30%] items-center justify-center [&_svg]:h-full [&_svg]:w-full">{glyph}</span>}
    </span>
  )
}
