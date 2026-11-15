import { DoorOpen, Plus } from 'lucide-react'
import { Button, askText } from '../ui'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { useBusy } from '../../lib/useBusy'
import { openEntry } from '../../lib/library'
import { useWorldSaves } from './useSaves'
import { noteMisfits } from './misfits'

export function useWorldList() {
  return useLive(() => engine('worlds.list'), 'worlds.changed') ?? []
}

export function TravelPanel({ world: target, map, place, sheet: who, onDone }: { world: string; map: string; place: string; sheet: string; onDone: () => void }) {
  const world = useWorldList().find((w) => w.id === target)
  const list = useWorldSaves(target)
  const sheet = useLive(() => engine('sheets.get', { id: who }), 'saves.changed')
  const [busy, run] = useBusy()
  if (!target || !world) return <span className="text-[13px] text-faint">This way leads nowhere yet.</span>
  const go = (id: string) =>
    void run(async () => {
      await engine('saves.travel', { sheet: who, id, map, place })
      if (sheet) await noteMisfits(who, sheet.title)
      onDone()
      openEntry('world', target)
    }, 'Could not go there')
  const fresh = () =>
    askText(`New save of ${world.name}`, 'Name', '', (name) =>
      void run(async () => {
        const made = await engine('saves.create', { world: target, name, copy: false })
        go(made.id)
      }, 'Could not make the save')
    )
  return (
    <div className="flex flex-col gap-3">
      <span className="text-[13px] text-dim">
        {sheet?.title ?? 'They'} leave{sheet ? 's' : ''} this save, taking their state, and join a save of <b className="text-white">{world.name}</b>.
      </span>
      <div className="flex flex-col gap-1.5">
        {(list?.saves ?? []).map((s) => (
          <button key={s.id} type="button" disabled={busy} onClick={() => go(s.id)} className="flex items-center gap-2 border border-line/50 px-3 py-2 text-left hover:border-accent/60">
            <DoorOpen className="h-4 w-4 text-accent" />
            <span className="flex-1 text-[13px] text-white">{s.name}</span>
            <span className="font-mono text-[11px] text-dim">{s.characters.length} in it</span>
          </button>
        ))}
      </div>
      <Button variant="primary" icon={<Plus />} className="self-start" disabled={busy} onClick={fresh}>
        A new save
      </Button>
    </div>
  )
}
