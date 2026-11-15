import { useEffect, useMemo, useState } from 'react'
import { Copy, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { avatarIdOfRef, avatarRendererInfo, avatarRenderers, type Avatar } from '@shared/avatars'
import { ACTIVITIES, MOODS, MOOD_NAMES, NEUTRAL_MOOD, moodDef, nearestMood, poseOf, type Activity, type AvatarPose, type MoodName } from '@shared/moods'
import { settingsFor, type SettingValue, type SettingValues } from '@shared/settingSpec'
import { engine } from '../../../lib/ipc'
import { errorText, formatRelative } from '../../../lib/format'
import { failed } from '../../../lib/notify'
import { toast } from '../../../store/toasts'
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
  const [activity, setActivity] = useState<Activity>('idle')
  const [dials, setDials] = useState<Dials | null>(null)

  const readOnly = Boolean(avatar?.builtin)
  const set = (patch: Partial<Draft>) => {
    if (!readOnly) editor.set((d) => (d ? { ...d, ...patch } : d))
  }
  const info = draft ? avatarRendererInfo(draft.renderer) : null
  const preview = useMemo<Avatar | null>(() => (draft ? { ...draft, id: selected ?? NEW_AVATAR, createdAt: 0, updatedAt: 0 } : null), [draft, selected])
  const pose: AvatarPose = {
    ...(dials ? { mood: nearestMood(dials.energy, dials.warmth, MOOD_NAMES) as MoodName, ...dials } : {}),
    activity,
    rate: ACTIVITIES.find((a) => a.name === activity)?.previewRate
  }

  const pick = (key: string) => {
    setEditing(key)
    const p = poseOf(key)
    const def = moodDef(p?.mood)
    setDials(def && def.name !== NEUTRAL_MOOD ? { energy: def.energy, warmth: def.warmth } : null)
    setActivity(p?.activity ?? 'idle')
  }
  const posed = editing !== BASE_POSE
  const marked = draft ? Object.keys(draft.poses) : []
  const clearPose = (key: string) => draft && set({ poses: withPose(draft.poses, key, {}) })
  const actions: PoseActions = { marked, onPick: pick, onClear: clearPose, readOnly }

  const specs = info ? (posed ? info.settings.filter((s) => info.poseSettings.includes(s.name)) : info.settings) : []
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
      <div className="flex w-60 shrink-0 flex-col gap-0.5 overflow-y-auto">
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
      <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
        {!draft || !preview ? (
          <EmptyState title="No avatar selected">Pick one on the left, or make a new one.</EmptyState>
        ) : (
          <>
            <div className="grid grid-cols-[minmax(0,1fr)_260px] gap-4">
              <div className="flex min-w-0 flex-col gap-2">
                <LiveAvatar avatar={preview} pose={pose} className="aspect-square w-full max-w-[420px]" />
                <SizeStrip avatar={preview} pose={pose} />
              </div>
              <div className="flex flex-col gap-3">
                <Field label="Mood" hint="Drag to try any blend. Click a mood to edit its look.">
                  <MoodPad value={dials} marks={marks} active={editing} onChange={setDials} onPick={pick} onMenu={(e, key) => openPoseMenu(e, key, actions)} />
                </Field>
                <Field label="Doing">
                  <Segmented value={activity} options={ACTIVITY_OPTIONS} onChange={setActivity} wrap />
                </Field>
                <Button size="sm" variant="ghost" icon={<RotateCcw />} onClick={() => pick(BASE_POSE)} className="self-start">
                  At rest
                </Button>
              </div>
            </div>
            <Field label="Editing the look for" hint="Base is how it always looks. A mood or activity can have its own look on top; right-click one to clear it.">
              <PoseChips value={editing} {...actions} />
            </Field>
            <div className="grid grid-cols-2 gap-x-5 gap-y-3">
              {!posed && (
                <>
                  <Field label="Name">
                    <Input value={draft.name} disabled={readOnly} onChange={(e) => set({ name: e.target.value })} />
                  </Field>
                  <Field label="Description">
                    <Input value={draft.description} disabled={readOnly} onChange={(e) => set({ description: e.target.value })} />
                  </Field>
                  {!readOnly && (
                    <div className="col-span-full">
                      <Field label="Drawn by">
                        <RendererPicker value={draft.renderer} onChange={switchRenderer} />
                      </Field>
                    </div>
                  )}
                </>
              )}
              <SettingControls specs={specs} values={values} onChange={change} readOnly={readOnly} changed={posed ? (Object.keys(draft.poses[editing] ?? {}) as string[]) : []} onReset={posed ? reset : undefined} />
            </div>
            <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-line pt-3">
              <span className="font-mono text-[10.5px] text-faint">
                {readOnly ? 'Built in: copy it to make your own.' : maker ? `Made by ${maker}.` : ''}
                {users.length ? ` Used by ${users.join(', ')}.` : ''}
              </span>
              <span className="ml-auto flex flex-wrap items-center gap-1.5">
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
              </span>
            </div>
          </>
        )}
      </div>
    </Panel>
  )
}
