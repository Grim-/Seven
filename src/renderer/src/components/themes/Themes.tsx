import { useEffect, useState } from 'react'
import { Copy, Plus, Star, Trash2 } from 'lucide-react'
import { SEVEN_THEME, cleanTheme, type Theme, type ThemeDraft } from '@shared/theme'
import type { SkinColour } from '@shared/themeLook'
import { engine } from '../../lib/ipc'
import { errorText, formatRelative } from '../../lib/format'
import { toast } from '../../store/toasts'
import { useApp } from '../../store/app'
import { useAgents } from '../../store/agents'
import { applyTheme, useThemes } from '../../store/themes'
import { Button, EmptyState, Panel, Select, askText, MakeOrSaved, useAutosavedState, ListRow, confirmDelete } from '../ui'
import { mainColour } from '../../lib/skins/mainColour'
import { rowMenu } from '../../views/data/entryMenu'
import { failed } from '../../lib/notify'
import { noteFailure } from '../../store/problems'
import { ThemeEditor } from './editor/ThemeEditor'

const NEW = '_new'

const SWATCHES: SkinColour[] = ['bg', 'accent', 'accent-soft', 'secondary']

function toDraft(t: Theme): ThemeDraft {
  const { id: _id, createdAt: _c, updatedAt: _u, builtin: _b, ...rest } = t
  return rest
}

export function Swatches({ theme }: { theme: Theme }) {
  return (
    <span className="flex shrink-0 border border-line/50">
      {SWATCHES.map((role) => (
        <span key={role} className="h-4 w-3" style={{ background: mainColour(theme, role) }} />
      ))}
    </span>
  )
}

export function ThemesPanel({ initial = null }: { initial?: string | null }) {
  const list = useThemes((s) => s.list)
  useEffect(() => {
    void useThemes.getState().refresh().catch(noteFailure('themes', 'Could not list the themes'))
  }, [])
  const settings = useApp((s) => s.settings)
  const agents = useAgents((s) => s.list)
  const [selected, setSelected] = useState<string | null>(initial === NEW ? NEW : (initial ?? settings?.defaultTheme ?? SEVEN_THEME.id))
  const theme = list.find((t) => t.id === selected) ?? null
  const editor = useAutosavedState<ThemeDraft | null>(
    initial === NEW ? { ...toDraft(SEVEN_THEME), name: '', description: '', createdBy: null } : null,
    (d) => engine('themes.save', { ...d!, id: selected }),
    { when: (d) => Boolean(d?.name.trim()) && Boolean(selected) && selected !== NEW }
  )
  const draft = editor.value
  const setDraft = editor.reset
  useEffect(() => {
    if (selected === NEW || editor.status === 'saving') return
    setDraft(theme ? toDraft(theme) : null)
  }, [selected, theme?.updatedAt])

  const readOnly = Boolean(theme?.builtin)
  const switching = useThemes((s) => s.switching)

  useEffect(() => {
    useThemes.setState({ preview: draft ? { ...SEVEN_THEME, ...cleanTheme(draft, SEVEN_THEME), id: theme?.id ?? NEW, builtin: readOnly, createdAt: 0, updatedAt: theme?.updatedAt ?? 0 } : null })
  }, [draft, theme?.id])
  useEffect(() => () => useThemes.setState({ preview: null }), [])

  const set = (patch: Partial<ThemeDraft>) => {
    if (!readOnly) editor.set((d) => (d ? { ...d, ...patch } : d))
  }
  const make = () =>
    draft &&
    void engine('themes.save', { ...draft, id: null })
      .then((saved) => {
        setSelected(saved.id)
        toast.success('Theme made', saved.name)
      })
      .catch(failed('Could not make the theme'))
  const copy = (from: Theme) =>
    askText('Copy theme', 'Name', `${from.name} copy`, async (name) => {
      try {
        const saved = await engine('themes.save', { ...toDraft(from), name, createdBy: null, id: null })
        setSelected(saved.id)
      } catch (err) {
        toast.error('Could not copy the theme', errorText(err))
      }
    })
  const remove = (t: Theme) =>
    confirmDelete(`Delete ${t.name}?`, 'Agents and chats using it go back to the default theme.', () => engine('themes.delete', { id: t.id }), () => setSelected(SEVEN_THEME.id))
  const create = () => {
    setSelected(NEW)
    setDraft({ ...toDraft(SEVEN_THEME), name: '', description: '', createdBy: null })
  }

  const users = theme ? agents.filter((a) => a.theme === theme.id).map((a) => a.name) : []
  const isDefault = theme && (settings?.defaultTheme ?? SEVEN_THEME.id) === theme.id
  const maker = draft?.createdBy ? (agents.find((a) => a.id === draft.createdBy)?.name ?? 'an agent') : null

  return (
    <Panel
      className="min-w-0 flex-1"
      title="Themes"
      meta={`${list.length}`}
      actions={
        <Button size="sm" variant="badge" icon={<Plus />} disabled={switching} onClick={create}>
          New theme
        </Button>
      }
      bodyClassName="flex min-h-0 gap-3 p-3"
    >
      <div className="flex w-60 shrink-0 flex-col gap-0.5 overflow-y-auto">
        {selected === NEW && <div className="border-l-2 border-l-accent bg-accent/10 px-2 py-1.5 text-[13px] text-ink">{draft?.name || 'New theme'}</div>}
        {list.map((t) => (
          <ListRow
            key={t.id}
            active={selected === t.id}
            disabled={switching}
            onClick={() => setSelected(t.id)}
            onMenu={rowMenu('theme', t.id, t.name, () => setSelected(t.id))}
            icon={<Swatches theme={t} />}
            title={t.name}
            subtitle={`${t.builtin ? 'built in' : formatRelative(t.updatedAt)}${(settings?.defaultTheme ?? SEVEN_THEME.id) === t.id ? ' · default' : ''}`}
            tone="tag"
          />
        ))}
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        {!draft ? (
          <EmptyState title="No theme selected">Pick one on the left, or make a new one.</EmptyState>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-ui text-[10.5px] text-faint">
                {readOnly ? 'Built in: copy it to make your own.' : maker ? `Made by ${maker}.` : ''}
                {users.length ? ` Used by ${users.join(', ')}.` : ''}
              </span>
              <span className="ml-auto flex flex-wrap items-center gap-1.5">
                <MakeOrSaved made={selected !== NEW} saver={editor} what="theme" onMake={make} disabled={!draft.name.trim()} />
                {theme && !isDefault && (
                  <Button size="sm" variant="ghost" icon={<Star />} onClick={() => applyTheme(theme.id)}>
                    Use as default
                  </Button>
                )}
                {theme && (
                  <Button size="sm" variant="ghost" icon={<Copy />} onClick={() => copy(theme)}>
                    Copy
                  </Button>
                )}
                {theme && !readOnly && (
                  <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={() => remove(theme)}>
                    Delete
                  </Button>
                )}
              </span>
            </div>
            <ThemeEditor draft={draft} set={set} readOnly={readOnly} />
          </>
        )}
      </div>
    </Panel>
  )
}

export function ThemePicker({ value, onChange, inherit }: { value: string | null; onChange: (id: string | null) => void; inherit: string }) {
  const list = useThemes((s) => s.list)
  return <Select value={value ?? ''} options={[{ value: '', label: inherit }, ...list.map((t) => ({ value: t.id, label: t.name }))]} onChange={(v) => onChange(v || null)} />
}
