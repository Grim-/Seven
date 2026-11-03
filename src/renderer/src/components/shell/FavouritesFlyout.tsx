import { KindIcon, openEntry } from '../../lib/library'
import { useFavourites } from '../../lib/favourites'
import { kindUi } from '../../registries/kinds'

export function FavouritesFlyout({ view }: { view: string }) {
  const list = useFavourites().filter((p) => p.id && kindUi(p.kind).ownView === view)
  if (!list.length) return null
  return (
    <div className="absolute bottom-full left-0 z-50 hidden min-w-[14rem] max-w-[22rem] flex-col border border-line bg-black/95 py-1 group-hover:flex">
      {list.map((p) => (
        <button key={`${p.kind}/${p.id}`} type="button" onClick={() => openEntry(p.kind, p.id as string)} className="flex items-center gap-2 px-3 py-1.5 text-left text-[12.5px] text-white/90 hover:bg-accent/15 hover:text-white">
          <KindIcon name={p.icon} className="h-3.5 w-3.5 shrink-0 text-accent" />
          <span className="truncate">{p.label}</span>
        </button>
      ))}
    </div>
  )
}
