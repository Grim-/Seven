import type { Theme } from '@shared/theme'
import { Markdown } from '../chat/Markdown'
import { Button, EmptyState } from '../ui'
import { useThemes, applyTheme } from '../../store/themes'
import { EntryCard, Facts } from '../entries/EntryCard'
import { Swatches } from './Themes'
import type { EntrySurfaceProps } from '../../registries/kinds'

function useThemeEntry(id: string): Theme | undefined {
  return useThemes((s) => s.list.find((t) => t.id === id))
}

function Sky({ theme, className }: { theme: Theme; className: string }) {
  return (
    <div className={`relative border border-line/50 ${className}`} style={{ background: `linear-gradient(180deg, ${theme.base}, ${theme.secondary}33 60%, ${theme.base})` }}>
      <div className="absolute inset-x-3 bottom-3 h-0.5" style={{ background: theme.accent, boxShadow: `0 0 12px ${theme.accent}` }} />
    </div>
  )
}

function Use({ id }: { id: string }) {
  return (
    <Button size="sm" variant="primary" onClick={() => applyTheme(id)}>
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
        <Sky theme={theme} className="h-24" />
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
      <Sky theme={theme} className="min-h-16 flex-1" />
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
  return (
    <div className="relative flex h-[70vh] flex-col gap-4 border p-6" style={{ borderColor: `${theme.accent}55`, background: `linear-gradient(180deg, ${theme.base}, ${theme.secondary}33 60%, ${theme.base})` }}>
      <div className="font-mono text-[13px] uppercase tracking-[0.2em]" style={{ color: theme.accent }}>
        {theme.name}
      </div>
      {theme.description && <Markdown text={theme.description} className="max-w-xl text-[15px] text-white/85" />}
      <Swatches theme={theme} />
      <span className="absolute right-6 top-5">
        <Use id={id} />
      </span>
      <div className="absolute inset-x-6 bottom-6 h-[3px]" style={{ background: theme.accent, boxShadow: `0 0 16px ${theme.accent}` }} />
    </div>
  )
}
