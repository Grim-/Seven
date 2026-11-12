import { useMemo, type ReactNode } from 'react'
import { Globe } from 'lucide-react'
import { viewsIn } from '../../views/registry'
import { showBrowser } from '../side/BrowserTab'
import { useTools } from '../../store/tools'
import { useApp } from '../../store/app'
import { useVault } from '../../store/vault'
import { usePlayer } from '../../store/player'
import { useFavourites } from '../../lib/favourites'
import { KindIcon, openEntry } from '../../lib/library'
import { useSheet } from '../../lib/sheet'
import { cn } from '../../lib/cn'
import { Button, Eyebrow, Sheet } from '../ui'
import { LockButton } from '../vault/Vault'
import { ThemeList } from '../themes/ThemeControl'
import { MiniPlayer } from './Player'

export const NAV_SHEET = 'nav'

function NavTile({ icon, label, active, onClick }: { icon: ReactNode; label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-11 min-w-0 items-center gap-2.5 border px-3 text-left text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors [&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0',
        active ? 'border-accent bg-accent/15 text-accent' : 'border-line/35 text-dim hover:border-line hover:text-white'
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 px-3 py-3">
      <Eyebrow>{title}</Eyebrow>
      {children}
    </div>
  )
}

export function NavMenu() {
  const sheet = useSheet(NAV_SHEET)
  const view = useApp((s) => s.view)
  const setView = useApp((s) => s.setView)
  const views = useMemo(() => [...viewsIn('tabs'), ...viewsIn('settings')], [])
  const links = useMemo(() => viewsIn('tabs').flatMap((t) => t.menu ?? []), [])
  const favourites = useFavourites().filter((p) => p.id)
  const track = usePlayer((s) => s.queue[s.index])
  const browserOn = useTools((s) => s.list.some((m) => m.id === 'browser' && m.state === 'on'))
  const vaultOn = useVault((s) => s.status.configured)
  const go = (run: () => void) => {
    sheet.close()
    run()
  }

  return (
    <Sheet
      open={sheet.open}
      onClose={sheet.close}
      title="Menu"
      bodyClassName="overflow-y-auto divide-y divide-line/30"
      footer={
        (browserOn || vaultOn) && (
          <div className="flex flex-wrap gap-2">
            {browserOn && (
              <Button variant="badge" size="lg" icon={<Globe />} onClick={() => go(() => showBrowser(null, true))}>
                Browser
              </Button>
            )}
            <LockButton />
          </div>
        )
      }
    >
      <Section title="Views">
        <div className="grid grid-cols-2 gap-1.5">
          {views.map((v) => (
            <NavTile key={v.id} icon={v.icon} label={v.label} active={view === v.id} onClick={() => go(() => setView(v.id))} />
          ))}
        </div>
      </Section>
      {links.length > 0 && (
        <Section title="More tools">
          <div className="grid grid-cols-2 gap-1.5">
            {links.map((l) => (
              <NavTile key={l.view} icon={l.icon} label={l.label} active={view === l.view} onClick={() => go(() => setView(l.view))} />
            ))}
          </div>
        </Section>
      )}
      {favourites.length > 0 && (
        <Section title="Favourites">
          <div className="flex flex-col gap-1">
            {favourites.map((p) => (
              <button
                key={`${p.kind}/${p.id}`}
                type="button"
                onClick={() => go(() => openEntry(p.kind, p.id as string))}
                className="flex min-h-11 items-center gap-2.5 border border-transparent px-2.5 text-left font-sans text-[13px] text-white/90 hover:border-line/40 hover:bg-accent/10"
              >
                <KindIcon name={p.icon} className="h-4 w-4 shrink-0 text-accent" />
                <span className="truncate">{p.label}</span>
              </button>
            ))}
          </div>
        </Section>
      )}
      {track && (
        <Section title="Player">
          <MiniPlayer layout="menu" />
        </Section>
      )}
      <Section title="Theme">
        <ThemeList />
      </Section>
    </Sheet>
  )
}
