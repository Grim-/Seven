import { useEffect, useMemo, useState } from 'react'
import { DEFAULT_LOOK, type AgentDraft, type AgentLook, type CharacterSheet } from '@shared/types'
import { POSE_OPTIONS, poseOf } from '@shared/moods'
import { AvatarField } from './AvatarField'
import { ColorRow, Field, Select, Slider } from '../ui'
import { AgentAvatar, LookBackground, lookVars } from './look'
import { PictureField } from '../pictures/PictureField'
import { MEDIA_OPTIONS } from '../pictures/mediaOptions'
import { engine } from '../../lib/ipc'
import { agentImageContext, useRegisterImageContext } from '../../lib/imagePromptContext'

export function LookEditor({ draft, onChange }: { draft: AgentDraft; onChange: (d: AgentDraft) => void }) {
  const look: AgentLook = { ...DEFAULT_LOOK, ...draft.look }
  const set = (patch: Partial<AgentLook>) => onChange({ ...draft, look: { ...look, ...patch } })
  const preview = { id: draft.id ?? 'draft', name: draft.name, look } as Parameters<typeof AgentAvatar>[0]['agent']
  const [pose, setPose] = useState('idle')
  const [linkedSheet, setLinkedSheet] = useState<CharacterSheet | null>(null)
  useEffect(() => {
    if (!draft.sheet) {
      setLinkedSheet(null)
      return
    }
    let live = true
    void engine('sheets.get', { id: draft.sheet })
      .then((sheet) => live && setLinkedSheet(sheet))
      .catch(() => live && setLinkedSheet(null))
    return () => {
      live = false
    }
  }, [draft.sheet])
  const agentContext = useMemo(() => agentImageContext(draft, linkedSheet), [draft, linkedSheet])
  useRegisterImageContext(agentContext)
  return (
    <div className="col-span-2 grid grid-cols-[1fr_220px] gap-4">
      <div className="flex flex-col gap-3">
        <Field label="Avatar" hint="Shown beside replies, in the chat header, on the overlay button and in lists. It reacts while the agent thinks, uses tools and talks, and to any mood the agent sets. Or use a picture, GIF or short video.">
          <AvatarField value={look.avatar} context={agentContext} onChange={(avatar) => set({ avatar })} />
        </Field>
        <Field label="Accent colour" hint="Used for the chat and the overlay while this agent's chat is open.">
          <ColorRow value={look.accent} onChange={(v) => set({ accent: v })} allowNone />
        </Field>
        <Field label="Background" hint="Shown behind the chat, dimmed.">
          <PictureField options={{ ...MEDIA_OPTIONS, what: 'a chat background', context: agentContext }} value={look.background} onChange={(id) => set({ background: id })} />
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
          <span className="truncate text-[12px] font-semibold caps-6 text-ink">{draft.name || 'Agent'}</span>
        </div>
        <div className="relative flex flex-1 flex-col gap-2 p-2.5">
          <span className="flex items-center gap-1.5 font-label text-[9.5px] font-semibold caps-18 text-secondary">
            <AgentAvatar agent={preview} size={16} />
            {draft.name || 'Agent'}
          </span>
          <span className="border-l-2 border-l-line pl-2 text-[12px] text-ink">Hello. This is how I look.</span>
          {look.avatar && (
            <div className="flex items-end gap-2">
              <AgentAvatar agent={preview} size={96} pose={poseOf(pose)} />
              <Select value={pose} options={POSE_OPTIONS} onChange={setPose} className="h-7 text-[11px]" />
            </div>
          )}
          <span className="mt-auto self-start border border-accent px-2 py-0.5 font-label text-[10px] caps text-accent">Send</span>
        </div>
      </div>
    </div>
  )
}
