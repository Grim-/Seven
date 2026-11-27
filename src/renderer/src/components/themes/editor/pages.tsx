import type { ComponentType, ReactNode } from 'react'
import { Baseline, Code2, Image, Info, Music, Palette, Shapes, Sparkles, Sun, Sunrise, Type, Wallpaper } from 'lucide-react'
import { SEVEN_THEME, type ThemeDraft } from '@shared/theme'
import { countKeys, type SectionProps } from './edit'
import { AboutPage } from './AboutPage'
import { ColoursPage } from './ColoursPage'
import { FontsPage } from './FontsPage'
import { TypePage } from './TypePage'
import { ShapePage } from './ShapePage'
import { PicturesPage } from './PicturesPage'
import { OrnamentsPage } from './OrnamentsPage'
import { SkiesPage } from './SkiesPage'
import { SurfacesPage } from './SurfacesPage'
import { SkyLightPage } from './SkyLightPage'
import { SceneryPage } from './SceneryPage'
import { SoundPage } from './SoundPage'

export interface ThemePage {
  id: string
  label: string
  group: string
  hint: string
  icon: ReactNode
  count: (draft: ThemeDraft) => number
  Page: ComponentType<SectionProps>
}

const differs = (a: unknown, b: unknown) => (a !== b ? 1 : 0)

export const THEME_PAGES: ThemePage[] = [
  { id: 'about', label: 'About', group: 'Theme', hint: 'Name, description', icon: <Info />, count: () => 0, Page: AboutPage },
  { id: 'colours', label: 'Colours', group: 'Look', hint: 'Main colours, then every role and tint', icon: <Palette />, count: (d) => countKeys(d.colours) + countKeys(d.tints) + (d.scheme ? 1 : 0), Page: ColoursPage },
  { id: 'fonts', label: 'Fonts', group: 'Look', hint: 'Families, numbers', icon: <Type />, count: (d) => countKeys(d.fonts) + (d.numerals ? 1 : 0), Page: FontsPage },
  { id: 'type', label: 'Text styles', group: 'Look', hint: 'Eyebrows, labels, titles', icon: <Baseline />, count: (d) => Object.values(d.type).reduce((n, t) => n + countKeys(t), 0), Page: TypePage },
  { id: 'shape', label: 'Shape', group: 'Look', hint: 'Corners, blur, shadow', icon: <Shapes />, count: (d) => countKeys(d.shape), Page: ShapePage },
  { id: 'pictures', label: 'Pictures', group: 'Look', hint: 'Textures, frame, divider', icon: <Image />, count: (d) => countKeys(d.images), Page: PicturesPage },
  { id: 'ornaments', label: 'Ornaments', group: 'Look', hint: 'Edges, tabs, marks, motion', icon: <Sparkles />, count: (d) => countKeys(d.options) + countKeys(d.ornament) + (d.motion.decode ? 0 : 1) + (d.motion.glitch ? 0 : 1), Page: OrnamentsPage },
  { id: 'skies', label: 'Skies', group: 'Look', hint: 'Sun and moon through the day', icon: <Sunrise />, count: (d) => (d.skies ? 1 : 0), Page: SkiesPage },
  { id: 'surfaces', label: 'Surfaces', group: 'Look', hint: 'CSS for each part of Seven', icon: <Code2 />, count: (d) => countKeys(d.surfaces), Page: SurfacesPage },
  { id: 'sky-light', label: 'Sky and light', group: 'Sound and scene', hint: 'Sky, mood light', icon: <Sun />, count: (d) => differs(d.sky, SEVEN_THEME.sky) + (d.light ? 1 : 0), Page: SkyLightPage },
  {
    id: 'scenery',
    label: 'Backdrop and effect',
    group: 'Sound and scene',
    hint: 'Picture, gradient, animation, chat fade',
    icon: <Wallpaper />,
    count: (d) => (d.backdrop ? 1 : 0) + (d.gradient ? 1 : 0) + differs(d.effect, SEVEN_THEME.effect) + countKeys(d.effectSettings) + differs(d.chatFadeOpacity, SEVEN_THEME.chatFadeOpacity),
    Page: SceneryPage
  },
  { id: 'sound', label: 'Music and sounds', group: 'Sound and scene', hint: 'Tracks, volume, sounds', icon: <Music />, count: (d) => d.music.length + differs(d.volume, SEVEN_THEME.volume) + Object.values(d.sounds).filter(Boolean).length, Page: SoundPage }
]

export function changedCount(draft: ThemeDraft): number {
  return THEME_PAGES.reduce((n, p) => n + p.count(draft), 0)
}
