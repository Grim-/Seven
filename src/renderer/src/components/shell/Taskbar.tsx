import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Globe, Menu as MenuIcon } from 'lucide-react'
import { viewsIn } from '../../views/registry'
import { showBrowser } from '../side/BrowserTab'
import { useTools } from '../../store/tools'
import { cn } from '../../lib/cn'
import { useApp } from '../../store/app'
import { useCompactLayout, useHasForm } from '../../lib/form'
import { useSheet } from '../../lib/sheet'
import { SoundControl } from './Audio'
import { MiniPlayer } from './Player'
import { LockButton } from '../vault/Vault'
import { ThemeButton } from '../themes/ThemeControl'
import { AppSearch } from './Search'
import { StatusControl } from './Status'
import { NotificationButton } from './Notifications'
import { FavouritesFlyout } from './FavouritesFlyout'
import { NavMenu, NAV_SHEET } from './NavMenu'

const ACTIVE_BAR =
  'absolute inset-x-1.5 top-0 h-0.5 bg-accent shadow-[0_0_8px_color-mix(in_srgb,var(--color-accent)_70%,transparent)]'

function tabClass(active: boolean, hasLabel: boolean): string {
  return cn(
    'relative flex h-full items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors [&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0',
    hasLabel
      ? 'px-3.5 tablet:gap-1.5 tablet:px-2.5 phone:flex-col phone:justify-center phone:gap-0.5 phone:px-2 phone:text-[9px] phone:leading-none phone:tracking-[0.04em]'
      : 'w-10 justify-center phone:w-9',
    active ? 'bg-accent/[0.07] text-accent' : 'text-dim hover:bg-white/[0.03] hover:text-white'
  )
}

function Tab({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label?: string; onClick: () => void }) {
  return (
    <button title={label ? undefined : 'Settings'} onClick={onClick} className={tabClass(active, Boolean(label))}>
      {active && <span className={ACTIVE_BAR} />}
      {icon}
      {label}
    </button>
  )
}

function ResponsiveTaskbar() {
  const view = useApp((s) => s.view)
  const setView = useApp((s) => s.setView)
  const compact = useCompactLayout()
  const menu = useSheet(NAV_SHEET)
  const tabs = useMemo(() => viewsIn('tabs'), [])
  const settingsTabs = useMemo(() => viewsIn('settings'), [])

  const slotRef = useRef<HTMLDivElement>(null)
  const tabMeasureRefs = useRef<(HTMLDivElement | null)[]>([])
  const menuMeasureRef = useRef<HTMLDivElement>(null)
  const [fitCount, setFitCount] = useState(0)

  useLayoutEffect(() => {
    const slot = slotRef.current
    const menuEl = menuMeasureRef.current
    if (!slot || !menuEl) return
    const recalc = () => {
      const budget = slot.clientWidth - menuEl.offsetWidth
      let used = 0
      let count = 0
      for (const el of tabMeasureRefs.current) {
        const w = el?.offsetWidth ?? 0
        if (used + w > budget) break
        used += w
        count++
      }
      setFitCount(count)
    }
    recalc()
    const observer = new ResizeObserver(recalc)
    observer.observe(slot)
    return () => observer.disconnect()
  }, [tabs, compact])

  const visibleTabs = tabs.slice(0, fitCount)
  const onBar = visibleTabs.some((t) => t.id === view) || (!compact && settingsTabs.some((t) => t.id === view))

  return (
    <nav className="relative z-40 flex h-11 shrink-0 items-stretch border-t border-line/40 bg-bg/95 px-1.5 tablet:h-[var(--nav-h)] tablet:pb-[env(safe-area-inset-bottom)] phone:px-0">
      <div ref={slotRef} className="relative flex min-w-0 flex-1 items-stretch overflow-hidden">
        <div aria-hidden className="pointer-events-none invisible absolute left-0 top-0 flex h-full items-stretch whitespace-nowrap">
          {tabs.map((item, i) => (
            <div
              key={item.id}
              ref={(el) => {
                tabMeasureRefs.current[i] = el
              }}
              className={tabClass(false, true)}
            >
              {item.icon}
              {item.label}
            </div>
          ))}
          <div ref={menuMeasureRef} className={tabClass(false, true)}>
            <MenuIcon />
            Menu
          </div>
        </div>
        <Tab active={menu.open || !onBar} icon={<MenuIcon />} label="Menu" onClick={menu.toggle} />
        {visibleTabs.map((item) => (
          <Tab key={item.id} active={view === item.id} icon={item.icon} label={item.label} onClick={() => setView(item.id)} />
        ))}
      </div>
      <div className="flex shrink-0 items-stretch font-mono text-[10.5px] uppercase tracking-wider">
        <AppSearch />
        <div className="flex items-center px-1.5 phone:px-1">
          <StatusControl />
        </div>
        <div className="my-2.5 w-px bg-line/40 phone:my-2" />
        <div className="flex items-stretch pl-0.5">
          <NotificationButton />
          <div className="flex h-full items-stretch phone:hidden">
            <LockButton compact />
            {settingsTabs.map((item) => (
              <Tab key={item.id} active={view === item.id} icon={item.icon} onClick={() => setView(item.id)} />
            ))}
          </div>
        </div>
      </div>
      <NavMenu />
    </nav>
  )
}

function DesktopTaskbar() {
  const view = useApp((s) => s.view)
  const setView = useApp((s) => s.setView)
  const browserOn = useTools((s) => s.list.some((m) => m.id === 'browser' && m.state === 'on'))

  return (
    <nav className="relative z-40 flex h-11 shrink-0 items-stretch border-t border-line/40 bg-bg/95 px-1.5">
      {viewsIn('tabs').map((item) => (
        <div key={item.id} className="group relative flex">
          <Tab active={view === item.id} icon={item.icon} label={item.label} onClick={() => setView(item.id)} />
          <FavouritesFlyout view={item.id} links={item.menu} />
        </div>
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
        {viewsIn('settings').map((item) => (
          <Tab key={item.id} active={view === item.id} icon={item.icon} onClick={() => setView(item.id)} />
        ))}
      </div>
    </nav>
  )
}

export function Taskbar() {
  const hasForm = useHasForm()
  return hasForm ? <ResponsiveTaskbar /> : <DesktopTaskbar />
}
