import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { moduleOn } from '../../lib/moduleOn'
import { failed } from '../../lib/notify'
import { Button, Pressable, ShellFace } from '../ui'
import { SheetPortrait } from '../data/SheetPortrait'
import { targetSources, type PlayTarget, type TargetContext } from '../../game/targets'

export function TargetPicker({ context, onPick, onCancel }: { context: TargetContext; onPick: (target: PlayTarget) => void; onCancel: () => void }) {
  const [targets, setTargets] = useState<PlayTarget[] | null>(null)
  useEffect(() => {
    void Promise.all(targetSources.on(moduleOn).map((s) => s.list(context)))
      .then((lists) => setTargets(lists.flat()))
      .catch(failed('Could not list targets'))
  }, [context.world, context.sheet, context.agents.join()])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = targets?.[Number(e.key) - 1]
      if (t) onPick(t)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [targets, onPick])
  return (
    <div className="flex flex-col gap-2.5">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-cyan">At whom?</span>
      {targets?.length === 0 && <span className="text-[12.5px] text-dim">Nothing to target.</span>}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-2.5">
        {(targets ?? []).map((t, i) => (
          <Pressable key={t.id} onClick={() => onPick(t)} title={`${i + 1}`} className="flex cursor-pointer text-left transition-transform hover:-translate-y-1">
            <ShellFace title={t.name} label={t.group} aside={`${i + 1}`} foot={t.note || undefined} art={<SheetPortrait image={t.image ?? null} className="h-full w-full border-0" />} className="w-full" />
          </Pressable>
        ))}
      </div>
      <div className="flex">
        <Button variant="ghost" icon={<X />} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
