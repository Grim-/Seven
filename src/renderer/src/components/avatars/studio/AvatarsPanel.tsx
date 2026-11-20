import { useEffect, useMemo, useRef, useState } from 'react'
import { Copy, Plus, RotateCcw, Trash2, Zap } from 'lucide-react'
import { avatarIdOfRef, avatarRendererInfo, avatarRenderers, type Avatar } from '@shared/avatars'
import { ACTIVITIES, MOODS, MOOD_NAMES, NEUTRAL_MOOD, REACTION_POSES, isReactionPose, moodDef, nearestMood, poseOf, type Activity, type AvatarPose, type MoodName } from '@shared/moods'
import { settingsFor, type SettingValue, type SettingValues } from '@shared/settingSpec'
import { engine } from '../../../lib/ipc'
import { errorText, formatRelative } from '../../../lib/format'
import { failed } from '../../../lib/notify'
import { toast } from '../../../store/toasts'
import { triggerVfx } from '../../../store/vfx'
import { useAgents } from '../../../store/agents'
import { useAvatars } from '../../../store/avatars'
import { rowMenu } from '../../../views/data/entryMenu'
import { Button, EmptyState, Field, Input, ListRow, MakeOrSaved, Panel, Segmented, askConfirm, askText, confirmDelete, useAutosavedState } from '../../ui'
import { SettingControls } from '../../settingSpec/SettingControls'
import { LiveAvatar } from '../LiveAvatar'
import { MoodPad, type Dials } from './MoodPad'
import { BASE_POSE, PoseChips, openPoseMenu, type PoseActions } from './PoseChips'
import { RendererPicker } from './RendererPicker'
import { SizeStrip } from './SizeStrip'

export const NEW_AVATAR = '_new'

type Draft = Omit<Avatar, 'id' | 'createdAt' | 'updatedAt' | 'builtin'>

const FIRST_RENDERER = avatarRenderers()[0]?.id ?? ''
const ACTIVITY_OPTIONS = ACTIVITIES.map((a) => ({ value: a.name as Activity, label: a.label }))
const SPEC_GROUPS: { value: string; label: string }[] = [
  { value: 'look', label: 'Look & Frames' },
  { value: 'frames', label: 'Frame Sequence' },
  { value: 'glances', label: 'Idle Glances' },
  { value: 'motion', label: 'Motion & FX' }
]

function toDraft(a: Avatar): Draft {
  const { id: _id, createdAt: _c, updatedAt: _u, builtin: _b, ...rest } = a
  return rest
}

function blank(renderer: string): Draft {
  const info = avatarRendererInfo(renderer)
  return { name: '', description: '', renderer, settings: info ? settingsFor(info.settings, {}) : {}, poses: {}, createdBy: null }
}

function withPose(poses: Record<string, SettingValues>, key: string, values: SettingValues): Record<string, SettingValues> {
  const next = { ...poses }
  if (Object.keys(values).length) next[key] = values
  else delete next[key]
  return next
}

export function AvatarsPanel({ initial = null }: { initial?: string | null }) {
  const list = useAvatars((s) => s.list)
  useEffect(() => {
    void useAvatars.getState().refresh().catch(() => undefined)
  }, [])
  const agents = useAgents((s) => s.list)
  const [selected, setSelected] = useState<string | null>(initial ?? list[0]?.id ?? null)
  const avatar = list.find((a) => a.id === selected) ?? null
  const editor = useAutosavedState<Draft | null>(initial === NEW_AVATAR ? blank(FIRST_RENDERER) : null, (d) => engine('avatars.save', { ...d!, id: selected }), {
    when: (d) => Boolean(d?.name.trim()) && Boolean(selected) && selected !== NEW_AVATAR
  })
  const draft = editor.value
  const setDraft = editor.reset
  useEffect(() => {
    if (selected === NEW_AVATAR || editor.status === 'saving') return
    setDraft(avatar ? toDraft(avatar) : null)
  }, [selected, avatar?.updatedAt])

  const [editing, setEditing] = useState(BASE_POSE)
  const [group, setGroup] = useState('look')
  const [activity, setActivity] = useState<Activity>('idle')
  const [dials, setDials] = useState<Dials | null>(null)
  const [liveReaction, setLiveReaction] = useState<string | null>(null)
  const reactionTimer = useRef<number | null>(null)

  const readOnly = Boolean(avatar?.builtin)
  const set = (patch: Partial<Draft>) => {
    if (!readOnly) editor.set((d) => (d ? { ...d, ...patch } : d))
  }
  const info = draft ? avatarRendererInfo(draft.renderer) : null
  const preview = useMemo<Avatar | null>(() => (draft ? { ...draft, id: selected ?? NEW_AVATAR, createdAt: 0, updatedAt: 0 } : null), [draft, selected])
  const studioTarget = preview ? `studio-avatar:${preview.id}` : null
  const pose: AvatarPose = {
    ...(dials ? { mood: nearestMood(dials.energy, dials.warmth, MOOD_NAMES) as MoodName, ...dials } : {}),
    activity,
    reaction: (isReactionPose(editing) ? editing : liveReaction) || null,
    rate: ACTIVITIES.find((a) => a.name === activity)?.previewRate
  }

  const pick = (key: string) => {
    setEditing(key)
    setLiveReaction(null)
    const p = poseOf(key)
    const def = moodDef(p?.mood)
    setDials(def && def.name !== NEUTRAL_MOOD ? { energy: def.energy, warmth: def.warmth } : null)
    setActivity(p?.activity ?? 'idle')
  }
  const triggerStudioReaction = (name: string) => {
    if (reactionTimer.current) window.clearTimeout(reactionTimer.current)
    setLiveReaction(name)
    if (studioTarget) triggerVfx(studioTarget, name === 'heal' ? { preset: 'flash', color: 'ok' } : { preset: 'hit', color: 'alert' })
    reactionTimer.current = window.setTimeout(() => setLiveReaction(null), 1500)
  }
  useEffect(() => () => {
    if (reactionTimer.current) window.clearTimeout(reactionTimer.current)
  }, [])

  const posed = editing !== BASE_POSE
  const marked = draft ? Object.keys(draft.poses) : []
  const clearPose = (key: string) => draft && set({ poses: withPose(draft.poses, key, {}) })
  const actions: PoseActions = { marked, onPick: pick, onClear: clearPose, readOnly }

  const specs = info ? (posed ? info.settings.filter((s) => info.poseSettings.includes(s.name)) : info.settings) : []
  const groupOptions = useMemo(() => {
    const present = new Set(specs.map((s) => s.group ?? 'look'))
    return SPEC_GROUPS.filter((g) => present.has(g.value))
  }, [specs])
  const activeGroup = groupOptions.some((g) => g.value === group) ? group : (groupOptions[0]?.value ?? 'look')
  const visibleSpecs = useMemo(() => specs.filter((s) => (s.group ?? 'look') === activeGroup), [specs, activeGroup])

  const values: SettingValues = draft ? (posed ? { ...draft.settings, ...draft.poses[editing] } : draft.settings) : {}
  const change = (name: string, value: SettingValue) => {
    if (!draft) return
    if (posed) set({ poses: { ...draft.poses, [editing]: { ...draft.poses[editing], [name]: value } } })
    else set({ settings: { ...draft.settings, [name]: value } })
  }
  const reset = (name: string) => {
    if (!draft) return
    const { [name]: _gone, ...rest } = draft.poses[editing] ?? {}
    set({ poses: withPose(draft.poses, editing, rest) })
  }
  const switchRenderer = (renderer: string) => {
    if (!draft || renderer === draft.renderer) return
    const next = avatarRendererInfo(renderer)
    const apply = () => set({ renderer, settings: next ? settingsFor(next.settings, draft.settings) : {}, poses: {} })
    if (marked.length) askConfirm('Change how it is drawn?', 'Its own looks for moods and activities are cleared.', 'Change', apply)
    else apply()
  }

  const make = () =>
    draft &&
    void engine('avatars.save', { ...draft, id: null })
      .then((saved) => {
        setSelected(saved.id)
        toast.success('Avatar made', saved.name)
      })
      .catch(failed('Could not make the avatar'))
  const copy = (from: Avatar) =>
    askText('Copy avatar', 'Name', `${from.name} copy`, async (name) => {
      try {
        const saved = await engine('avatars.save', { ...toDraft(from), name, createdBy: null, id: null })
        setSelected(saved.id)
      } catch (err) {
        toast.error('Could not copy the avatar', errorText(err))
      }
    })
  const remove = (a: Avatar) => confirmDelete(`Delete ${a.name}?`, 'Agents using it go back to their initial.', () => engine('avatars.delete', { id: a.id }), () => setSelected(list[0]?.id ?? null))
  const create = () => {
    setSelected(NEW_AVATAR)
    setDraft(blank(FIRST_RENDERER))
    pick(BASE_POSE)
  }

  const users = avatar ? agents.filter((a) => avatarIdOfRef(a.look.avatar) === avatar.id).map((a) => a.name) : []
  const maker = draft?.createdBy ? (agents.find((a) => a.id === draft.createdBy)?.name ?? 'an agent') : null
  const marks = MOODS.map((m) => ({ name: m.name, label: m.label, energy: m.energy, warmth: m.warmth, marked: marked.includes(m.name) }))

  return (
    <Panel
      className="min-w-0 flex-1"
      title="Avatars"
      meta={`${list.length}`}
      actions={
        <Button size="sm" variant="badge" icon={<Plus />} onClick={create}>
          New avatar
        </Button>
      }
      bodyClassName="flex min-h-0 gap-3 p-3"
    >
      <div className="flex w-52 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-line/40 pr-2">
        {selected === NEW_AVATAR && <div className="border-l-2 border-l-accent bg-accent/10 px-2 py-1.5 text-[13px] text-white">{draft?.name || 'New avatar'}</div>}
        {list.map((a) => (
          <ListRow
            key={a.id}
            active={selected === a.id}
            onClick={() => setSelected(a.id)}
            onMenu={rowMenu('avatar', a.id, a.name, () => setSelected(a.id))}
            icon={<LiveAvatar avatar={a} size={24} />}
            title={a.name}
            subtitle={a.builtin ? 'built in' : formatRelative(a.updatedAt)}
            tone="tag"
          />
        ))}
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {!draft || !preview ? (
          <EmptyState title="No avatar selected">Pick one on the left, or make a new one.</EmptyState>
        ) : (
          <>
            <div className="flex shrink-0 flex-wrap items-start gap-4 border-b border-line/50 pb-3">
              <div className="flex shrink-0 flex-col gap-2">
                <LiveAvatar avatar={preview} pose={pose} target={studioTarget} size={136} />
                <SizeStrip avatar={preview} pose={pose} />
              </div>

              <div className="flex min-w-[240px] flex-1 flex-col gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={draft.name}
                    disabled={readOnly}
                    placeholder="Avatar name..."
                    onChange={(e) => set({ name: e.target.value })}
                    className="min-w-[160px] flex-1"
                  />
                  <div className="flex flex-wrap items-center gap-1.5">
                    <MakeOrSaved made={selected !== NEW_AVATAR} saver={editor} what="avatar" onMake={make} disabled={!draft.name.trim()} />
                    {avatar && (
                      <Button size="sm" variant="ghost" icon={<Copy />} onClick={() => copy(avatar)}>
                        Copy
                      </Button>
                    )}
                    {avatar && !readOnly && (
                      <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={() => remove(avatar)}>
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
                <Input
                  value={draft.description}
                  disabled={readOnly}
                  placeholder="Short description of how it looks or reacts..."
                  onChange={(e) => set({ description: e.target.value })}
                />
                {!readOnly && (
                  <Field label="Style">
                    <RendererPicker value={draft.renderer} onChange={switchRenderer} />
                  </Field>
                )}
                <span className="font-mono text-[10px] text-faint">
                  {readOnly ? 'Built in: click Copy to make an editable copy.' : maker ? `Made by ${maker}.` : ''}
                  {users.length ? ` Used by ${users.join(', ')}.` : ''}
                </span>
              </div>

              <div className="flex shrink-0 items-start gap-3 border-l border-line/40 pl-3">
                <MoodPad value={dials} marks={marks} active={editing} onChange={setDials} onPick={pick} onMenu={(e, key) => openPoseMenu(e, key, actions)} className="w-32 shrink-0" />
                <div className="flex w-44 flex-col gap-2">
                  <Field label="Doing">
                    <Segmented value={activity} options={ACTIVITY_OPTIONS} onChange={setActivity} wrap />
                  </Field>
                  <Field label="Test FX">
                    <div className="flex flex-wrap gap-1">
                      {REACTION_POSES.map((r) => (
                        <Button key={r.name} size="sm" variant="badge" onClick={() => triggerStudioReaction(r.name)}>
                          {r.label}
                        </Button>
                      ))}
                      {(['pulse', 'wobble', 'glitch', 'highlight'] as const).map((preset) => (
                        <Button key={preset} size="sm" variant="ghost" icon={<Zap />} onClick={() => studioTarget && triggerVfx(studioTarget, { preset })}>
                          {preset}
                        </Button>
                      ))}
                      <Button size="sm" variant="ghost" icon={<RotateCcw />} onClick={() => pick(BASE_POSE)}>
                        Rest
                      </Button>
                    </div>
                  </Field>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-end justify-between gap-2 border-b border-line/40 py-2.5">
              <Field label="State / pose" className="min-w-0 flex-1">
                <PoseChips value={editing} {...actions} />
              </Field>
              {groupOptions.length > 1 && <Segmented value={activeGroup} options={groupOptions} onChange={setGroup} />}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pt-3 pr-1">
              <div className="flex flex-wrap items-start gap-x-5 gap-y-3">
                <SettingControls
                  specs={visibleSpecs}
                  values={values}
                  onChange={change}
                  readOnly={readOnly}
                  changed={posed ? (Object.keys(draft.poses[editing] ?? {}) as string[]) : []}
                  onReset={posed ? reset : undefined}
                  itemClassName="min-w-[200px] max-w-[290px] flex-1"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </Panel>
  )
}
