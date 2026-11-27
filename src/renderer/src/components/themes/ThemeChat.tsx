import type { Theme } from '@shared/theme'
import { Markdown } from '../chat/Markdown'
import { Button, EmptyState } from '../ui'
import { useThemes, applyTheme } from '../../store/themes'
import { EntryCard, Facts } from '../entries/EntryCard'
import { Swatches } from './Themes'
import { mainColour } from '../../lib/skins/mainColour'
import { ThemePreview } from './ThemePreview'
import type { EntrySurfaceProps } from '../../registries/kinds'

function useThemeEntry(id: string): Theme | undefined {
  return useThemes((s) => s.list.find((t) => t.id === id))
}

function skyOf(theme: Theme): string {
  const base = mainColour(theme, 'bg')
  return `linear-gradient(180deg, ${base}, color-mix(in srgb, ${mainColour(theme, 'secondary')} 20%, transparent) 60%, ${base})`
}

function Use({ id }: { id: string }) {
  const switching = useThemes((s) => s.switching)
  return (
    <Button size="sm" variant="primary" disabled={switching} onClick={() => applyTheme(id)}>
      Use
    </Button>
  )
}

export function ThemeChat({ id }: EntrySurfaceProps) {
  const theme = useThemeEntry(id)
  if (!theme) return <EmptyState title="Removed">This theme no longer exists.</EmptyState>
  return (
    <EntryCard title={theme.name} tag="theme" aside={<Use id={id} />}>
      <div className="grid grid-cols-[180px_1fr] gap-3">
        <ThemePreview theme={theme} className="h-32" />
        <div className="flex flex-col gap-2">
          <Swatches theme={theme} />
          <Facts rows={[['Sky', theme.sky], ['Effect', theme.effect || 'none'], ['Music', theme.music.length ? `${theme.music.length} tracks` : 'none']]} />
        </div>
      </div>
      {theme.description && <Markdown text={theme.description} className="text-[12.5px] text-dim" />}
    </EntryCard>
  )
}

export function ThemeWidget({ id }: EntrySurfaceProps) {
  const theme = useThemeEntry(id)
  if (!theme) return null
  return (
    <div className="flex h-full flex-col gap-2">
      <ThemePreview theme={theme} className="min-h-16 flex-1" />
      <div className="flex items-center gap-2">
        <Swatches theme={theme} />
        <span className="ml-auto">
          <Use id={id} />
        </span>
      </div>
    </div>
  )
}

export function ThemeStage({ id }: EntrySurfaceProps) {
  const theme = useThemeEntry(id)
  if (!theme) return null
  const accent = mainColour(theme, 'accent')
  return (
    <div className="relative flex h-[70vh] flex-col gap-4 border p-6" style={{ borderColor: `color-mix(in srgb, ${accent} 33%, transparent)`, background: skyOf(theme) }}>
      <div className="font-label text-[13px] caps-20 " style={{ color: accent }}>
        {theme.name}
      </div>
      {theme.description && <Markdown text={theme.description} className="max-w-xl text-[15px] text-ink/85" />}
      <Swatches theme={theme} />
      <span className="absolute right-6 top-5">
        <Use id={id} />
      </span>
      <div className="absolute inset-x-6 bottom-6 h-[3px]" style={{ background: accent, boxShadow: `0 0 16px ${accent}` }} />
    </div>
  )
}

export function ThemeThumb({ id }: EntrySurfaceProps) {
  const theme = useThemeEntry(id)
  return theme ? <ThemePreview theme={theme} className="h-full w-full" /> : null
}
