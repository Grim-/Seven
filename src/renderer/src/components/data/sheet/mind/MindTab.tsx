import { useState } from 'react'
import { ExternalLink, Sparkles } from 'lucide-react'
import type { CharacterMind, CharacterSheet } from '@shared/types'
import { useStyleList } from '../../../../store/styles'
import { useAgents } from '../../../../store/agents'
import { openEntry } from '../../../../lib/library'
import { Button, Eyebrow, Field, SearchBox, Select, Toggle } from '../../../ui'
import { LinkTextarea } from '../../LinkTextarea'
import { MemoryList } from './MemoryList'

function clean(m: CharacterMind): CharacterMind | null {
  const reasoningStyle = m.reasoningStyle?.trim() || null
  const howItThinks = m.howItThinks?.trim() || undefined
  const voiceConstraints = m.voiceConstraints?.trim() || undefined
  const forceReason = m.forceReason === true ? true : undefined
  const memories = m.memories?.length ? m.memories : undefined
  if (!reasoningStyle && !howItThinks && !voiceConstraints && !forceReason && !memories) return null
  return {
    ...(reasoningStyle ? { reasoningStyle } : {}),
    ...(howItThinks ? { howItThinks } : {}),
    ...(voiceConstraints ? { voiceConstraints } : {}),
    ...(forceReason ? { forceReason } : {}),
    ...(memories ? { memories } : {})
  }
}

export function MindTab({
  sheet,
  mind,
  onChange
}: {
  sheet: CharacterSheet
  mind: CharacterMind | null
  onChange: (next: CharacterMind | null) => void
}) {
  const [query, setQuery] = useState('')
  const styles = useStyleList((s) => s.list)
  const agents = useAgents((s) => s.list)
  const wornBy = agents.filter((a) => a.sheet === sheet.id)
  const val: CharacterMind = mind ?? {}
  const set = (patch: Partial<CharacterMind>) => onChange(clean({ ...val, ...patch }))
  const pickedStyle = val.reasoningStyle ? styles.find((s) => s.id === val.reasoningStyle || s.name.toLowerCase() === val.reasoningStyle?.toLowerCase()) ?? null : null

  return (
    <div className="mx-auto flex w-full max-w-[920px] flex-col gap-5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-l-2 border-accent pl-3">
        <div className="flex flex-col gap-0.5">
          <Eyebrow className="text-accent">Character Mind &amp; Output Filter</Eyebrow>
          <span className="text-[12.5px] text-dim">
            Shapes how {sheet.title} thinks before replying and filters every line of dialogue and action through their voice.
          </span>
        </div>
        {wornBy.length > 0 && (
          <span className="border border-line/50 px-2 py-0.5 font-mono text-[10.5px] text-dim">
            Worn by {wornBy.map((a) => a.name).join(', ')}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 border border-line/40 bg-black/30 p-4">
        <Field
          label="Reasoning style"
          hint="Modus operandi & inner voices used before replying (both in the reason tool and internal thinking). Reusable styles live in Data under Reasoning styles."
        >
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={val.reasoningStyle ?? ''}
              options={[
                { value: '', label: 'Inherit from agent / chat setting' },
                ...styles.map((s) => ({ value: s.id, label: s.name }))
              ]}
              onChange={(v) => set({ reasoningStyle: v || null })}
              className="h-8 min-w-[16rem] flex-1 text-[12.5px]"
            />
            {pickedStyle && (
              <Button size="sm" variant="ghost" icon={<ExternalLink />} onClick={() => openEntry('style', pickedStyle.id)}>
                Open style
              </Button>
            )}
          </div>
        </Field>

        {pickedStyle && (
          <div className="flex flex-col gap-1.5 border border-line/40 bg-panel/25 px-3 py-2.5 text-[12px]">
            <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-accent">
              <Sparkles className="h-3 w-3" />
              {pickedStyle.name}
            </div>
            <div className="text-white/85">{pickedStyle.instruction}</div>
            {pickedStyle.voices.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {pickedStyle.voices.map((v) => (
                  <span key={v.label} title={v.line} className="border border-line/50 px-1.5 py-0.5 font-mono text-[10.5px] text-dim">
                    {v.label}
                  </span>
                ))}
              </div>
            )}
            {pickedStyle.constraints?.trim() && (
              <div className="border-t border-line/30 pt-1.5 text-[11.5px] text-cyan/90">
                Constraints: {pickedStyle.constraints}
              </div>
            )}
          </div>
        )}

        <Field
          label="Character modus operandi (how they think)"
          hint="Optional character-specific reasoning instructions applied in pre-output thinking/reason before acting or speaking."
        >
          <LinkTextarea
            rolls={false}
            rows={3}
            value={val.howItThinks ?? ''}
            onValue={(howItThinks) => set({ howItThinks })}
            placeholder="e.g. Always weigh what a bargain costs in crystal or owed favours first. Suspect surface-dwellers of rushing without checking the stonework."
          />
        </Field>

        <Field
          label="Speaking & output filter constraints"
          hint="Rules that forcefully filter dialogue, word choice, and actions through this character's Speech, Motivations & goals, and Core beliefs before writing any reply."
        >
          <LinkTextarea
            rolls={false}
            rows={3}
            value={val.voiceConstraints ?? ''}
            onValue={(voiceConstraints) => set({ voiceConstraints })}
            placeholder="e.g. Clipped, earth-and-stone metaphors; never sound like a helpful assistant or apologize politely. Say only what this character would risk aloud."
          />
        </Field>

        <Field
          label="Pre-output deliberation"
          hint="Require calling the reason tool before generating dialogue when the wearing agent has Mind tools enabled."
        >
          <Toggle
            checked={val.forceReason === true}
            onChange={(forceReason) => set({ forceReason })}
            label={val.forceReason ? 'Always deliberate with reason before speaking' : 'Use wearing agent / chat default'}
          />
        </Field>
      </div>

      <section className="flex flex-col gap-3 border border-line/40 bg-black/25 p-4">
        <SearchBox value={query} onChange={setQuery} placeholder="Search character memories" className="max-w-sm" />
        <MemoryList memories={val.memories ?? []} query={query} onChange={(memories) => set({ memories })} />
      </section>
    </div>
  )
}
