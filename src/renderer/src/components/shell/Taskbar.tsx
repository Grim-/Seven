import { Globe, Settings as SettingsIcon } from 'lucide-react'
import { VIEW_TABS } from './views'
import { showBrowser } from '../side/BrowserTab'
import { useTools } from '../../store/tools'
import { cn } from '../../lib/cn'
import { useApp } from '../../store/app'
import { SoundControl } from './Audio'
import { MiniPlayer } from './Player'
import { LockButton } from '../vault/Vault'
import { ThemeButton } from '../themes/ThemeControl'
import { AppSearch } from './Search'
import { StatusControl } from './Status'
import { NotificationButton } from './Notifications'

function Tab({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label?: string; onClick: () => void }) {
  return (
    <button
      title={label ? undefined : 'Settings'}
      onClick={onClick}
      className={cn(
        'relative flex h-full items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors [&>svg]:h-4 [&>svg]:w-4',
        label ? 'px-3.5' : 'w-10 justify-center',
        active ? 'bg-accent/[0.07] text-accent' : 'text-dim hover:bg-white/[0.03] hover:text-white'
      )}
    >
      {active && <span className="absolute inset-x-1.5 top-0 h-0.5 bg-accent shadow-[0_0_8px_color-mix(in_srgb,var(--color-accent)_70%,transparent)]" />}
      {icon}
      {label}
    </button>
  )
}

export function Taskbar() {
  const view = useApp((s) => s.view)
  const setView = useApp((s) => s.setView)
  const browserOn = useTools((s) => s.list.some((m) => m.id === 'browser' && m.state === 'on'))

  return (
    <nav className="relative z-40 flex h-11 shrink-0 items-stretch border-t border-line/40 bg-bg/95 px-1.5">
      {VIEW_TABS.map((item) => (
        <Tab key={item.id} active={view === item.id} icon={item.icon} label={item.label} onClick={() => setView(item.id)} />
      ))}
      <AppSearch />
      <div className="ml-auto flex items-center gap-2.5 pr-2 font-mono text-[10.5px] uppercase tracking-wider">
        <div className="flex h-7 items-center gap-2 border border-line/30 px-1.5">
          <MiniPlayer />
          <SoundControl />
          <span className="h-4 w-px bg-line/40" />
          <ThemeButton />
          {browserOn && (
            <button title="Open the browser" onClick={() => showBrowser(null, true)} className="flex h-6 w-6 items-center justify-center text-dim hover:text-accent">
              <Globe className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <StatusControl />
      </div>
      <div className="my-2.5 w-px bg-line/40" />
      <div className="flex items-stretch pl-1">
        <NotificationButton />
        <LockButton compact />
        <Tab active={view === 'settings'} icon={<SettingsIcon />} onClick={() => setView('settings')} />
      </div>
    </nav>
  )
}
