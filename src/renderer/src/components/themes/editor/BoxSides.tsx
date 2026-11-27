import { TunableRow } from '../../ui'
import type { SurfaceStyle } from '@shared/themeLook'
import { readProps, sides, writeProps } from '../../../lib/skins/surfaceCss'
import { SidesField, type Sides } from './SidesField'

const EDGES = ['top', 'right', 'bottom', 'left'] as const

export function BoxSides({ style, onChange, prop, label, hint }: { style: SurfaceStyle; onChange: (next: SurfaceStyle) => void; prop: 'padding' | 'margin'; label: string; hint: string }) {
  const names = EDGES.map((e) => `${prop}-${e}`)
  const now = readProps(style, '', names)
  const set = names.some((n) => now[n])
  const value = sides(names.map((n) => now[n] || '0').join(' '))
  const write = (next: Sides | null) => onChange(writeProps(style, '', Object.fromEntries(names.map((n, i) => [n, next ? `${next[i]}px` : null]))))
  return (
    <TunableRow label={label} hint={hint} changed={set} onReset={() => write(null)} wide>
      <SidesField value={value} min={prop === 'padding' ? 0 : undefined} onChange={write} />
    </TunableRow>
  )
}
