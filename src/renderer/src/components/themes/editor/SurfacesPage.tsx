import { useCallback, useEffect, useState } from 'react'
import { skinSurfaces, type SurfaceStyle } from '@shared/themeLook'
import { SettingCard, Textarea } from '../../ui'
import { cssProblem, cssToStyle, styleToCss } from '../../../lib/skins/surfaceCss'
import { withKey, type SectionProps } from './edit'
import { SurfaceList } from './SurfaceList'
import { EdgeTiling } from './EdgeTiling'
import { BoxSides } from './BoxSides'
import { DecorPlacement } from './DecorPlacement'
import { useSurfaceOutline, useSurfacePick } from './useSurfacePreview'

const EMPTY: SurfaceStyle = {}

export function SurfacesPage({ draft, set }: SectionProps) {
  const [current, setCurrent] = useState(() => skinSurfaces()[0]?.id ?? 'app')
  const styled = draft.surfaces ?? EMPTY
  const style = styled[current] ?? EMPTY
  const [text, setText] = useState(() => styleToCss(style))
  useEffect(() => setText(styleToCss(styled[current] ?? EMPTY)), [current])
  const save = (next: SurfaceStyle) => set({ surfaces: withKey(styled, current, Object.keys(next).length ? next : null) as Record<string, SurfaceStyle> })
  const fromControls = (next: SurfaceStyle) => {
    save(next)
    setText(styleToCss(next))
  }
  const fromText = (next: string) => {
    setText(next)
    const parsed = cssToStyle(next)
    if (parsed) save(parsed)
  }
  const { picking, pick } = useSurfacePick(useCallback((id: string) => setCurrent(id), []))
  useSurfaceOutline(current)
  const problem = text.trim() ? cssProblem(text) : null
  const label = skinSurfaces().find((s) => s.id === current)?.label ?? current
  return (
    <div className="grid grid-cols-[15rem_minmax(0,1fr)] gap-3 tablet:grid-cols-1">
      <SurfaceList value={current} onChange={setCurrent} styled={styled} picking={picking} onPick={pick} />
      <div className="flex min-w-0 flex-col gap-3">
        <SettingCard title={`${label} CSS`} intro="Any CSS. & is this surface; nest selectors for what's inside it. url(a_…) uses a picture from Files, which travels with the theme. Saved in the theme as properties.">
          <Textarea mono rows={12} value={text} onChange={(e) => fromText(e.target.value)} placeholder={'padding: 12px;\n&::before {\n  content: "";\n}'} />
          {problem && <span className="text-[11.5px] text-alert">{problem}</span>}
        </SettingCard>
        <SettingCard title="Edges">
          <EdgeTiling style={style} onChange={fromControls} />
        </SettingCard>
        <SettingCard title="Spacing">
          <BoxSides style={style} onChange={fromControls} prop="padding" label="Padding" hint="Space inside the surface, in px." />
          <BoxSides style={style} onChange={fromControls} prop="margin" label="Margin" hint="Space around the surface, in px." />
        </SettingCard>
        <SettingCard title="Decorations">
          <DecorPlacement style={style} onChange={fromControls} part="::before" label="First decoration" surface={current} />
          <DecorPlacement style={style} onChange={fromControls} part="::after" label="Second decoration" surface={current} />
        </SettingCard>
      </div>
    </div>
  )
}
