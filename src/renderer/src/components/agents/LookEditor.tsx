import { useState } from 'react'
import { AVATAR_STATES, CODED_AVATARS, DEFAULT_LOOK, type AgentDraft, type AgentLook, type AvatarState } from '@shared/types'
import { ColorRow, Field, Select, Slider } from '../ui'
import { AgentAvatar, LookBackground, lookVars } from './look'
import { PictureField } from '../pictures/PictureField'
import type { PictureOptions } from '../data/PicturePicker'

const MEDIA: PictureOptions = { kinds: ['image', 'video'], what: 'a picture, GIF or video' }

export function LookEditor({ draft, onChange }: { draft: AgentDraft; onChange: (d: AgentDraft) => void }) {
  const look: AgentLook = { ...DEFAULT_LOOK, ...draft.look }
  const set = (patch: Partial<AgentLook>) => onChange({ ...draft, look: { ...look, ...patch } })
  const preview = { id: draft.id ?? 'draft', name: draft.name, look } as Parameters<typeof AgentAvatar>[0]['agent']
  const [mood, setMood] = useState<AvatarState>('idle')
  const coded = look.avatar?.kind === 'coded'
  return (
    <div className="col-span-2 grid grid-cols-[1fr_220px] gap-4">
      <div className="flex flex-col gap-3">
        <Field label="Picture" hint="A picture, GIF or short video. Shown beside replies, in the chat header, on the overlay button and in lists.">
          <PictureField options={MEDIA} value={look.avatar?.kind === 'file' ? look.avatar.assetId : null} onChange={(id) => set({ avatar: id ? { kind: 'file', assetId: id } : null })} />
        </Field>
        <Field label="Animated avatar" hint="A drawn avatar that reacts: thinking while the agent reasons, talking while it writes, and any mood the agent sets itself. Replaces the picture.">
          <Select
            value={coded && look.avatar?.kind === 'coded' ? look.avatar.type : ''}
            options={[{ value: '', label: 'None' }, ...CODED_AVATARS.map((c) => ({ value: c.id, label: c.label }))]}
            onChange={(v) => set({ avatar: v ? { kind: 'coded', type: v } : null })}
            className="h-8 text-[12px]"
          />
        </Field>
        <Field label="Accent colour" hint="Used for the chat and the overlay while this agent's chat is open.">
          <ColorRow value={look.accent} onChange={(v) => set({ accent: v })} allowNone />
        </Field>
        <Field label="Background" hint="Shown behind the chat, dimmed.">
          <PictureField options={MEDIA} value={look.background} onChange={(id) => set({ background: id })} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label={`Background strength ${Math.round(look.backgroundOpacity * 100)}%`}>
            <Slider value={Math.round(look.backgroundOpacity * 100)} min={5} max={100} step={5} onChange={(v) => set({ backgroundOpacity: v / 100 })} />
          </Field>
          <Field label={`Tint ${look.tint ? `${Math.round(look.tintStrength * 100)}%` : 'off'}`}>
            <div className="flex flex-col gap-1.5">
              <ColorRow value={look.tint} onChange={(v) => set({ tint: v })} allowNone />
              {look.tint && <Slider value={Math.round(look.tintStrength * 100)} min={5} max={80} step={5} onChange={(v) => set({ tintStrength: v / 100 })} />}
            </div>
          </Field>
        </div>
      </div>
      <div style={lookVars(look)} className="relative flex h-full min-h-48 flex-col overflow-hidden border border-accent/60 bg-bg">
        <LookBackground look={look} />
        <div className="relative flex items-center gap-2 border-b border-line px-2.5 py-2">
          <AgentAvatar agent={preview} size={28} />
          <span className="truncate text-[12px] font-semibold uppercase tracking-[0.06em] text-white">{draft.name || 'Agent'}</span>
        </div>
        <div className="relative flex flex-1 flex-col gap-2 p-2.5">
          <span className="flex items-center gap-1.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.18em] text-teal">
            <AgentAvatar agent={preview} size={16} />
            {draft.name || 'Agent'}
          </span>
          <span className="border-l-2 border-l-line pl-2 text-[12px] text-white">Hello. This is how I look.</span>
          {coded && (
            <div className="flex items-end gap-2">
              <AgentAvatar agent={preview} size={96} mood={mood} />
              <Select value={mood} options={AVATAR_STATES.map((m) => ({ value: m, label: m }))} onChange={(v) => setMood(v as AvatarState)} className="h-7 text-[11px]" />
            </div>
          )}
          <span className="mt-auto self-start border border-accent px-2 py-0.5 font-mono text-[10px] uppercase text-accent">Send</span>
        </div>
      </div>
    </div>
  )
}
