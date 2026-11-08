import { useState } from 'react'
import { Gift } from 'lucide-react'
import { ITEM_TEMPLATES } from '@shared/game/defs'
import { Button } from '../ui'
import { engine } from '../../lib/ipc'
import { useBusy } from '../../lib/useBusy'
import { toast } from '../../store/toasts'
import { useGameDefs } from '../game/useGameDefs'

export function ItemReward({ sheet, item, count, gold, onTaken }: { sheet: string; item: string; count: number; gold: number; onTaken?: () => void }) {
  const items = useGameDefs(ITEM_TEMPLATES).list ?? []
  const [busy, run] = useBusy()
  const [taken, setTaken] = useState(false)
  const name = items.find((i) => i.id === item)?.name ?? item
  const take = () =>
    void run(async () => {
      const got = await engine('game.giveItem', { sheet, item, count, gold })
      toast.success('Taken', [got.given ? `${got.given} × ${name}` : '', got.gold ? `${got.gold} gold` : ''].filter(Boolean).join(', ') || 'Nothing fitted in the bag.')
      setTaken(true)
      onTaken?.()
    }, 'Could not take it')
  return (
    <div className="flex items-center gap-3 border border-line/50 bg-black/40 p-3 text-[13.5px]">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {item && (
          <span>
            <span className="font-mono text-accent">{count} ×</span> {name}
          </span>
        )}
        {gold > 0 && (
          <span>
            <span className="font-mono text-accent">{gold}</span> gold
          </span>
        )}
        {!item && !gold && <span className="text-faint">Nothing here.</span>}
      </div>
      <Button variant="primary" icon={<Gift />} disabled={busy || taken || (!item && !gold)} onClick={take}>
        {taken ? 'Taken' : 'Take'}
      </Button>
    </div>
  )
}
