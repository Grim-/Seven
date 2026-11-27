import { useEffect, useMemo, useState } from 'react'
import { avatarRendererInfo, avatarRenderers, type Avatar } from '@shared/avatars'
import { settingsFor } from '@shared/settingSpec'
import { engine } from '../../../lib/ipc'
import { failed } from '../../../lib/notify'
import { toast } from '../../../store/toasts'
import { noteFailure } from '../../../store/problems'
import { useAvatars } from '../../../store/avatars'
import { askConfirm, askText, confirmDelete, useAutosavedState } from '../../ui'

export const NEW_AVATAR = '_new'

export type AvatarDraft = Omit<Avatar, 'id' | 'createdAt' | 'updatedAt' | 'builtin'>

const FIRST_RENDERER = avatarRenderers()[0]?.id ?? ''

function toDraft(a: Avatar): AvatarDraft {
  const { id: _id, createdAt: _c, updatedAt: _u, builtin: _b, ...rest } = a
  return rest
}

function blank(renderer: string): AvatarDraft {
  const info = avatarRendererInfo(renderer)
  return { name: '', description: '', renderer, settings: info ? settingsFor(info.settings, {}) : {}, poses: {}, createdBy: null }
}

export function useAvatarDraft(initial: string | null) {
  const list = useAvatars((s) => s.list)
  useEffect(() => {
    void useAvatars.getState().refresh().catch(noteFailure('avatars', 'Could not load the avatars'))
  }, [])
  const [selected, select] = useState<string | null>(initial ?? list[0]?.id ?? null)
  const isNew = selected === NEW_AVATAR
  const avatar = list.find((a) => a.id === selected) ?? null
  const editor = useAutosavedState<AvatarDraft | null>(isNew ? blank(FIRST_RENDERER) : null, (d) => engine('avatars.save', { ...d!, id: selected }), {
    when: (d) => Boolean(d?.name.trim()) && Boolean(selected) && selected !== NEW_AVATAR
  })
  const draft = editor.value
  useEffect(() => {
    if (isNew || editor.status === 'saving') return
    editor.reset(avatar ? toDraft(avatar) : null)
  }, [selected, avatar?.updatedAt])

  const readOnly = Boolean(avatar?.builtin)
  const set = (patch: Partial<AvatarDraft>) => {
    if (!readOnly) editor.set((d) => (d ? { ...d, ...patch } : d))
  }
  const preview = useMemo<Avatar | null>(() => (draft ? { ...draft, id: selected ?? NEW_AVATAR, createdAt: 0, updatedAt: 0 } : null), [draft, selected])

  const create = () => {
    select(NEW_AVATAR)
    editor.reset(blank(FIRST_RENDERER))
  }
  const make = () => {
    if (!draft) return
    void engine('avatars.save', { ...draft, id: null })
      .then((saved) => {
        select(saved.id)
        toast.success('Avatar made', saved.name)
      })
      .catch(failed('Could not make the avatar'))
  }
  const copy = (from: Avatar) =>
    askText('Copy avatar', 'Name', `${from.name} copy`, (name) =>
      engine('avatars.save', { ...toDraft(from), name, createdBy: null, id: null })
        .then((saved) => select(saved.id))
        .catch(failed('Could not copy the avatar'))
    )
  const remove = (a: Avatar) =>
    confirmDelete(`Delete ${a.name}?`, 'Agents using it go back to their initial.', () => engine('avatars.delete', { id: a.id }), () => select(list.find((o) => o.id !== a.id)?.id ?? null))
  const switchRenderer = (renderer: string) => {
    if (!draft || renderer === draft.renderer) return
    const next = avatarRendererInfo(renderer)
    const apply = () => set({ renderer, settings: next ? settingsFor(next.settings, draft.settings) : {}, poses: {} })
    if (Object.keys(draft.poses).length) askConfirm('Change how it is drawn?', 'Its own looks for moods and activities are cleared.', 'Change', apply)
    else apply()
  }

  return { list, selected, select, isNew, avatar, editor, draft, preview, readOnly, set, create, make, copy, remove, switchRenderer }
}

export type AvatarDraftState = ReturnType<typeof useAvatarDraft>
