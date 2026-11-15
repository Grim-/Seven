import { showName } from '@shared/ids'
import type { MainView } from '../../views/registry'
import { showPage } from '../../views/PagesView'
import { KindIcon } from '../../lib/library'
import { isFileFavouriteKind, openFavourite, useFavourites } from '../../lib/favourites'
import { kindUi } from '../../registries/kinds'
import { useApp } from '../../store/app'

export function FavouritesFlyout({ view, links = [] }: { view: string; links?: MainView['menu'] }) {
  const setView = useApp((s) => s.setView)
  const list = useFavourites().filter((p) => {
    if (isFileFavouriteKind(p.kind)) return view === 'pages' && Boolean(p.id)
    const own = kindUi(p.kind).ownView
    return own ? own === view && Boolean(p.id) : view === 'data'
  })
  if (!list.length && !links.length) return null
  return (
    <div className="absolute bottom-full left-0 z-50 hidden max-h-[70vh] min-w-[14rem] max-w-[22rem] flex-col overflow-y-auto border border-line bg-black/95 py-1 group-hover:flex tablet:hidden">
      {links.map((l) => (
        <button
          key={l.view ?? l.label}
          type="button"
          onClick={() => (l.onSelect ? l.onSelect() : l.view && setView(l.view))}
          className="flex items-center gap-2 px-3 py-1.5 text-left text-[12.5px] text-white/90 hover:bg-accent/15 hover:text-white [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:shrink-0 [&>svg]:text-accent"
        >
          {l.icon}
          <span className="truncate">{l.label}</span>
        </button>
      ))}
      {links.length > 0 && list.length > 0 && <div className="my-1 h-px bg-line/40" />}
      {list.map((p) => (
        <button
          key={`${p.kind}/${p.id ?? ''}`}
          type="button"
          onClick={() => (isFileFavouriteKind(p.kind) && p.id ? showPage(p.id) : openFavourite(p))}
          className="flex items-center gap-2 px-3 py-1.5 text-left text-[12.5px] text-white/90 hover:bg-accent/15 hover:text-white"
        >
          <KindIcon name={p.icon} className="h-3.5 w-3.5 shrink-0 text-accent" />
          <span className="min-w-0 flex-1 truncate">{showName(p.label)}</span>
          {!p.id && <span className="shrink-0 font-mono text-[9.5px] uppercase tracking-wider text-faint">Kind</span>}
        </button>
      ))}
    </div>
  )
}
