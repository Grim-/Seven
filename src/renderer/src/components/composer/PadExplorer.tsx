import { Dices, Shuffle } from 'lucide-react'
import { KindExplorer } from '../library/KindExplorer'
import { DrawPanel } from '../draw/DrawPanel'
import { PlayBuilder } from '../play/PlayBuilder'
import { entryLink } from '../../store/data'
import type { Pad } from './pad'

const TRY = { link: null, agents: [] }

export function PadExplorer({ id, pad, onAdded }: { id: string; pad: Pad; onAdded?: () => void }) {
  const add = (texts: string[]) => {
    pad.add(texts)
    onAdded?.()
  }
  return (
    <KindExplorer
      id={id}
      onPick={(kind, entry) => add([entryLink(kind, entry)])}
      tabs={[
        { id: 'draw', label: 'Draw', icon: <Shuffle className="h-3.5 w-3.5" />, node: <DrawPanel onUse={(picked) => add(picked.map((p) => p.value))} onClose={() => onAdded?.()} /> },
        { id: 'play', label: 'Action or decision', icon: <Dices className="h-3.5 w-3.5" />, node: <PlayBuilder kind="action" character={null} where={TRY} keepLabel="Put on the paper" onKeep={(_kind, text) => add([text])} /> }
      ]}
    />
  )
}
