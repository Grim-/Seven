import { FaceGrid, ShellTabs } from '../ui'
import { EntryPicker } from '../library/EntryPicker'
import { DrawPanel } from '../draw/DrawPanel'
import { PlayBuilder } from '../play/PlayBuilder'
import { LiveCard } from '../cards/LiveCard'
import { CARD_TYPE, useTypePages } from '../cards/model'
import { entryLink } from '../../store/data'
import { dragEntries } from '../../lib/entryDrag'
import { useViewPlace } from '../../lib/viewPlace'

type SideTab = 'library' | 'draw' | 'play' | 'cards'

const TABS: { value: SideTab; label: string }[] = [
  { value: 'library', label: 'Library' },
  { value: 'draw', label: 'Draw' },
  { value: 'play', label: 'Play' },
  { value: 'cards', label: 'Cards' }
]

const TRY = { link: null, agents: [] }

export function ComposerSide({ onAdd }: { onAdd: (texts: string[]) => void }) {
  const [tab, setTab] = useViewPlace<SideTab>('composer.tab', 'library')
  const cards = useTypePages(CARD_TYPE)
  return (
    <div className="flex min-h-0 flex-col gap-2 border border-line/40 bg-black/40 p-2">
      <ShellTabs value={tab} options={TABS} onChange={setTab} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'library' && <EntryPicker inline kind={null} title="Put on the paper" onPick={(hit) => onAdd([entryLink(hit.kind, hit.id)])} onClose={() => undefined} />}
        {tab === 'draw' && <DrawPanel onUse={(picked) => onAdd(picked.map((p) => p.value))} onClose={() => setTab('library')} />}
        {tab === 'play' && <PlayBuilder kind="action" character={null} where={TRY} keepLabel="Put on the paper" onKeep={(_kind, text) => onAdd([text])} />}
        {tab === 'cards' && (
          <FaceGrid scale={0.7}>
            {cards.map((c) => (
              <button key={c.id} type="button" draggable onDragStart={(e) => dragEntries(e, [c.id])} onClick={() => onAdd([entryLink('cards.card', c.id)])} title="Put on the paper" className="text-left">
                <LiveCard id={c.id} />
              </button>
            ))}
          </FaceGrid>
        )}
      </div>
    </div>
  )
}
