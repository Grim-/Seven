import { useContext, type ReactNode } from 'react'
import { ExternalLink, Sparkles } from 'lucide-react'
import type { CharacterMind, CharacterSheet } from '@shared/types'
import { useStyleList } from '../../../../store/styles'
import { useAgents } from '../../../../store/agents'
import { openEntry } from '../../../../lib/library'
import { Button, Eyebrow, Toggle } from '../../../ui'
import { BrowsePick } from '../../../ui/BrowsePick'
import { InsideSlateContext } from '../../../entries/EntryCard'
import { MarkdownEditor } from '../../MarkdownEditor'

function clean(m: CharacterMind): CharacterMind | null {
  const reasoningStyle = m.reasoningStyle?.trim() || null
  const howItThinks = m.howItThinks?.trim() ? m.howItThinks : undefined
  const voiceConstraints = m.voiceConstraints?.trim() ? m.voiceConstraints : undefined
  const forceReason = m.forceReason === true ? true : undefined
  const memories = m.memories?.length ? m.memories : undefined
  const knowledge = m.knowledge?.length ? m.knowledge : undefined
  const excluded = m.excluded?.length ? m.excluded : undefined
  if (!reasoningStyle && !howItThinks && !voiceConstraints && !forceReason && !memories && !knowledge && !excluded) return null
  return {
    ...(reasoningStyle ? { reasoningStyle } : {}),
    ...(howItThinks ? { howItThinks } : {}),
    ...(voiceConstraints ? { voiceConstraints } : {}),
    ...(forceReason ? { forceReason } : {}),
    ...(memories ? { memories } : {}),
    ...(knowledge ? { knowledge } : {}),
    ...(excluded ? { excluded } : {})
  }
}

function Column({ label, tip, children }: { label: string; tip: string; children: ReactNode }) {
  return (
    <section className="flex min-h-[14rem] min-w-0 flex-col gap-2 border border-line/40 tone-panel-30 p-3">
      <span title={tip} className="w-fit cursor-default">
        <Eyebrow className="text-accent">{label}</Eyebrow>
      </span>
      {children}
    </section>
  )
}

export function MindTab({ sheet, mind, onChange }: { sheet: CharacterSheet; mind: CharacterMind | null; onChange: (next: CharacterMind | null) => void }) {
  const inSlate = useContext(InsideSlateContext)
  const styles = useStyleList((s) => s.list)
  const agents = useAgents((s) => s.list)
  const wornBy = agents.filter((a) => a.sheet === sheet.id)
  const val: CharacterMind = mind ?? {}
  const set = (patch: Partial<CharacterMind>) => onChange(clean({ ...val, ...patch }))
  const picked = val.reasoningStyle ? (styles.find((s) => s.id === val.reasoningStyle || s.name.toLowerCase() === val.reasoningStyle?.toLowerCase()) ?? null) : null

  return (
    <div className={inSlate ? 'grid grid-cols-1 gap-2' : 'grid min-h-[26rem] grid-cols-1 gap-3 p-3 lg:h-[calc(100vh-13rem)] lg:grid-cols-[minmax(17rem,22rem)_minmax(0,1fr)_minmax(0,1fr)]'}>
      <Column label="Reasoning" tip="The style and inner voices used before replying">
        <div className="flex items-stretch gap-1.5">
          <BrowsePick
            value={picked?.id ?? null}
            options={styles.map((s) => ({ value: s.id, label: s.name, group: 'Reasoning styles', note: s.instruction }))}
            placeholder="From the agent or chat"
            onChange={(id) => set({ reasoningStyle: id })}
            className="min-w-0 flex-1"
          />
          {picked && <Button size="sm" variant="ghost" icon={<ExternalLink />} title="Open the style" onClick={() => openEntry('style', picked.id)} />}
        </div>
        {picked && (
          <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto border border-line/40 tone-surface-25 px-3 py-2.5 text-[12px]">
            <div className="flex items-center gap-1.5 font-label text-[10px] caps-5 text-accent">
              <Sparkles className="h-3 w-3" />
              {picked.name}
            </div>
            <div className="text-ink/85">{picked.instruction}</div>
            {picked.voices.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {picked.voices.map((v) => (
                  <span key={v.label} title={v.line} className="border border-line/50 px-1.5 py-0.5 font-ui text-[10.5px] text-dim">
                    {v.label}
                  </span>
                ))}
              </div>
            )}
            {picked.constraints?.trim() && <div className="border-t border-line/30 pt-1.5 text-[11.5px] text-secondary-ink/90">{picked.constraints}</div>}
          </div>
        )}
        <div className="mt-auto flex flex-col gap-2 border-t border-line/30 pt-2">
          <span title="Calls the reason tool before speaking when the wearing agent has Mind tools" className="w-fit">
            <Toggle checked={val.forceReason === true} onChange={(forceReason) => set({ forceReason })} label="Always deliberate before speaking" />
          </span>
          <span className="font-ui text-[11px] text-dim">{wornBy.length ? `Worn by ${wornBy.map((a) => a.name).join(', ')}` : 'No agent wears this character'}</span>
        </div>
      </Column>

      <Column label="How they think" tip="Character-specific reasoning applied before acting or speaking">
        <MarkdownEditor key={`${sheet.id}:howItThinks`} compact value={val.howItThinks ?? ''} onValue={(howItThinks) => set({ howItThinks })} className="min-h-0 flex-1" placeholder="What they weigh first, what they suspect, what they never assume" />
      </Column>

      <Column label="Voice and output filter" tip="Rules every line of dialogue and action passes through">
        <MarkdownEditor key={`${sheet.id}:voiceConstraints`} compact value={val.voiceConstraints ?? ''} onValue={(voiceConstraints) => set({ voiceConstraints })} className="min-h-0 flex-1" placeholder="Word choice, rhythm, what they would never say aloud" />
      </Column>
    </div>
  )
}
