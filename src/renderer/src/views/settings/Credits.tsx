import { useEffect } from 'react'
import { ExternalLink } from 'lucide-react'
import { SettingCard, StatusBadge } from '../../components/ui'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { useViewPlace } from '../../lib/viewPlace'

export function Credits() {
  const credits = useLive(() => engine('credits.list'), ['credits.changed', 'tools.changed']) ?? []
  const [selectedId, setSelectedId] = useViewPlace('settings.credits.id', '')

  useEffect(() => {
    if (credits.length > 0 && !credits.some((c) => c.id === selectedId)) {
      setSelectedId(credits[0].id)
    }
  }, [credits, selectedId, setSelectedId])

  const active = credits.find((c) => c.id === selectedId) ?? credits[0] ?? null

  return (
    <SettingCard title="Credits & Attribution">
      {!active ? (
        <p className="py-2 font-ui text-[11px] text-faint">No attributions registered.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 pt-1 md:grid-cols-[230px_minmax(0,1fr)]">
          <div className="flex flex-col gap-1 border-b border-line/40 pb-2 md:border-b-0 md:border-r md:pb-0 md:pr-3">
            {credits.map((item) => {
              const selected = item.id === active.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={
                    selected
                      ? 'flex items-center justify-between gap-2 border border-accent/60 bg-accent/10 px-2.5 py-2 text-left'
                      : 'flex items-center justify-between gap-2 border border-transparent px-2.5 py-2 text-left hover:border-line/60 hover:tone-well-35'
                  }
                >
                  <div className="min-w-0">
                    <div className={selected ? 'truncate font-ui text-[11.5px] font-semibold text-ink' : 'truncate font-ui text-[11.5px] text-ink'}>
                      {item.name}
                    </div>
                    <div className="flex items-center gap-1.5 font-label text-[10px] caps-12 text-faint">
                      <span className="truncate">{item.category}</span>
                      {item.moduleDisabled && <span className="shrink-0 text-tint-amber-ink">· off</span>}
                    </div>
                  </div>
                  <span className="shrink-0 font-ui text-[9.5px] text-dim">{item.license}</span>
                </button>
              )
            })}
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/40 pb-2">
              <div>
                <h3 className="font-ui text-[13px] font-bold tracking-[0.06em] text-ink">{active.name}</h3>
                <span className="font-label text-[10px] caps-14 text-faint">{active.category}</span>
              </div>
              <div className="flex items-center gap-2">
                {active.moduleDisabled && <StatusBadge tone="warn">Module disabled</StatusBadge>}
                <StatusBadge tone="idle">{active.license}</StatusBadge>
                {active.url && (
                  <a
                    href={active.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 border border-line/60 px-2 py-0.5 font-ui text-[10.5px] text-dim hover:border-line-hover hover:text-ink"
                  >
                    Source
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>

            {active.moduleDisabled && (
              <div className="border border-tint-amber/40 bg-tint-amber/10 px-2.5 py-1.5 font-ui text-[11px] text-tint-amber-ink">
                The <strong className="text-ink">{active.moduleName ?? active.moduleId}</strong> module is currently turned off. This attribution stays listed because its files are still installed.
              </div>
            )}

            <div className="flex flex-col gap-1">
              <div className="font-label text-[10px] caps-14 text-faint">Used in Seven</div>
              <p className="text-[12.5px] leading-relaxed text-ink">{active.usedFor}</p>
            </div>

            {active.attribution && (
              <div className="flex flex-col gap-1">
                <div className="font-label text-[10px] caps-14 text-faint">Attribution &amp; License Notice</div>
                <div className="whitespace-pre-wrap border border-line/50 tone-panel-45 p-3 font-ui text-[11px] leading-relaxed text-dim">
                  {active.attribution}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </SettingCard>
  )
}
