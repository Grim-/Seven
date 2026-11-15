import { useState, type ReactNode } from 'react'
import { Skull, Users } from 'lucide-react'
import type { Point } from '@shared/shapes'
import { EntryPicker } from '../library/EntryPicker'
import { cn } from '../../lib/cn'
import { BestiaryPicker } from './BestiaryPicker'

export type SpawnTab = 'cast' | 'bestiary'

const TABS: { id: SpawnTab; label: string; icon: ReactNode }[] = [
  { id: 'cast', label: 'Party & cast', icon: <Users className="h-3.5 w-3.5" /> },
  { id: 'bestiary', label: 'Bestiary & NPCs', icon: <Skull className="h-3.5 w-3.5" /> }
]

export function SpawnTokenModal({ world, map, at, start, onPickSheet, onClose }: { world: string; map: string; at: Point; start: SpawnTab; onPickSheet: (sheet: string) => void; onClose: () => void }) {
  const [tab, setTab] = useState<SpawnTab>(start)
  return (
    <div className="flex w-[560px] max-w-full flex-col gap-3 p-3 font-mono text-[12px]">
      <div className="grid grid-cols-2 border-b border-line">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} className={cn('flex items-center justify-center gap-2 py-2 uppercase tracking-[0.12em]', tab === t.id ? 'border-b-2 border-cyan text-white' : 'text-dim hover:text-white')}>
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'cast' ? <EntryPicker kind="sheet" title="Put a character here" inline onClose={onClose} onPick={(hit) => onPickSheet(hit.id)} /> : <BestiaryPicker world={world} map={map} at={at} onDone={onClose} />}
    </div>
  )
}
