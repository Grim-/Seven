import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import type { CharacterSheet } from '@shared/types'
import { engine } from '../../lib/ipc'
import { onLibraryChange } from '../../lib/library'
import { openSevenLink } from '../../lib/links'
import { Markdown } from '../chat/Markdown'
import { SheetPortrait } from './SheetPortrait'

export function SheetCard({ id }: { id: string }) {
  const [sheet, setSheet] = useState<CharacterSheet | null | undefined>(undefined)
  useEffect(() => {
    const load = () =>
      void engine('sheets.get', { id })
        .then(setSheet)
        .catch(() => setSheet(null))
    load()
    return onLibraryChange(load)
  }, [id])
  if (sheet === undefined) return <div className="font-mono text-[11px] text-dim">Loading…</div>
  if (!sheet) return <div className="font-mono text-[11px] text-dim">This character sheet no longer exists.</div>
  const filled = sheet.fields.filter((f) => sheet.values[f]?.trim())
  return (
    <div className="relative overflow-hidden border border-accent/70 bg-black/80 shadow-[0_0_18px_color-mix(in_srgb,var(--color-accent)_12%,transparent)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-accent/10 to-transparent" />
      <div className="relative flex items-center gap-4 border-b border-line/50 p-4">
        <SheetPortrait image={sheet.image} className="h-24 w-24" />
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent-soft">Character</div>
          <div className="truncate text-[24px] font-bold leading-tight tracking-wide text-white">{sheet.title}</div>
          <div className="mt-0.5 font-mono text-[10.5px] text-faint">{filled.length} of {sheet.fields.length} fields filled</div>
        </div>
        <button title="Open the sheet" onClick={() => openSevenLink(`seven:sheet/${encodeURIComponent(sheet.id)}`)} className="self-start p-1 text-dim hover:text-accent">
          <ExternalLink className="h-4 w-4" />
        </button>
      </div>
      {filled.length ? (
        <div className="relative grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-px bg-line/20">
          {filled.map((f) => (
            <section key={f} className="flex flex-col gap-1 bg-black/85 px-4 py-3">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-accent">{f}</span>
              <div className="text-[13px] leading-relaxed text-white/90">
                <Markdown text={sheet.values[f]} />
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="px-4 py-3 text-[12.5px] italic text-faint">Nothing written on this sheet yet.</div>
      )}
    </div>
  )
}
