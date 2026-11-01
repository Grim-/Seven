import { useEffect, useRef, useState } from 'react'
import { Check, Palette } from 'lucide-react'
import { DEFAULT_THEME_ID } from '@shared/theme'
import { useThemes, useActiveTheme, applyTheme } from '../../store/themes'
import { useApp } from '../../store/app'
import { useAgents } from '../../store/agents'
import { cn } from '../../lib/cn'
import { Swatches } from './Themes'
import { useAgentIdOf, useFocusedConversation } from '../../lib/conversation'

function useOverride(): string | null {
  const { theme, ambience } = useActiveTheme()
  const fallback = useApp((s) => s.settings?.defaultTheme ?? DEFAULT_THEME_ID)
  const agentId = useAgentIdOf(useFocusedConversation())
  const agentTheme = useAgents((s) => s.list.find((a) => a.id === agentId)?.theme ?? null)
  if (theme.id === fallback) return null
  if (ambience.theme === theme.id) return `This chat shows ${theme.name}: the agent changed it for a while.`
  if (agentTheme === theme.id) return `This chat shows ${theme.name}: its agent has its own theme.`
  return null
}

export function ThemeList({ className }: { className?: string }) {
  const list = useThemes((s) => s.list)
  const current = useApp((s) => s.settings?.defaultTheme ?? DEFAULT_THEME_ID)
  const override = useOverride()
  return (
    <div className={cn('flex min-h-0 flex-col gap-1', className)}>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {list.map((t) => (
          <button
            key={t.id}
            onClick={() => applyTheme(t.id)}
            title={t.description || t.name}
            className={cn('flex w-full items-center gap-2.5 px-2 py-1.5 text-left normal-case tracking-normal', t.id === current ? 'bg-accent/10 text-white' : 'text-white/80 hover:bg-white/[0.04]')}
          >
            <Swatches theme={t} />
            <span className="min-w-0 flex-1 truncate font-sans text-[12.5px]">{t.name}</span>
            {t.id === current && <Check className="h-3.5 w-3.5 shrink-0 text-accent" />}
          </button>
        ))}
      </div>
      {override && <div className="px-2 font-sans text-[11px] normal-case tracking-normal text-faint">{override}</div>}
    </div>
  )
}

export function ThemeGlance() {
  return <ThemeList className="h-full" />
}

export function ThemeButton() {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', key)
    }
  }, [open])
  return (
    <div ref={box} className="relative flex items-center">
      <button title="Theme" onClick={() => setOpen(!open)} className={cn('flex h-6 w-6 items-center justify-center', open ? 'text-accent' : 'text-dim hover:text-accent')}>
        <Palette className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 bottom-full z-50 mb-2 flex max-h-80 w-64 flex-col border border-line bg-bg/95 p-1 shadow-[0_0_24px_rgba(0,0,0,0.6)]">
          <ThemeList className="max-h-80" />
        </div>
      )}
    </div>
  )
}
