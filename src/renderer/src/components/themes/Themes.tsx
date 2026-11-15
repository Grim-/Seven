import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Copy, Play, Plus, Star, Trash2, X } from 'lucide-react'
import { SEVEN_THEME, SKY_MODES, cleanTheme, type SkyMode, type Theme, type ThemeSoundEvent } from '@shared/theme'
import { BACKGROUND_MODULE, CORE_EFFECTS, backgroundInfo, backgroundList, effectSettingsFor } from '@shared/backgrounds'
import { SettingControls } from '../settingSpec/SettingControls'
import { useTools } from '../../store/tools'
import { runCue } from '../shell/ThemeStage'
import { engine } from '../../lib/ipc'
import { errorText, formatRelative } from '../../lib/format'
import { toast } from '../../store/toasts'
import { useApp } from '../../store/app'
import { useData } from '../../store/data'
import { useAgents } from '../../store/agents'
import { useThemes } from '../../store/themes'
import { Button, EmptyState, Field, Input, Panel, Select, Slider, Toggle, askText, MakeOrSaved, useAutosavedState, ListRow, confirmDelete } from '../ui'
import { rowMenu } from '../../views/data/entryMenu'
import { failed } from '../../lib/notify'
import { noteFailure } from '../../store/problems'

const NEW = '_new'

const SKY_LABELS: Record<SkyMode, string> = { off: 'No sky', clock: 'Follow the time of day', dawn: 'Dawn', day: 'Day', dusk: 'Dusk', night: 'Night' }
const SOUND_LABELS: Record<ThemeSoundEvent, string> = { reply: 'A reply finishes', reminder: 'A reminder fires', ask: 'Seven asks you something' }

type Draft = Omit<Theme, 'id' | 'createdAt' | 'updatedAt' | 'builtin'>

function toDraft(t: Theme): Draft {
  const { id: _id, createdAt: _c, updatedAt: _u, builtin: _b, ...rest } = t
  return rest
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-t border-line/40 pt-3">
      <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.16em] text-accent-soft">{title}</div>
      {children}
    </div>
  )
}

function ColorField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled: boolean }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input type="color" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className="h-9 w-11 cursor-pointer border border-line/50 bg-transparent" />
        <Input value={value} disabled={disabled} onChange={(e) => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && onChange(e.target.value)} className="font-mono text-[12.5px]" />
      </div>
    </Field>
  )
}

export function Swatches({ theme }: { theme: Pick<Theme, 'accent' | 'accentSoft' | 'secondary' | 'base'> }) {
  return (
    <span className="flex shrink-0 border border-line/50">
      {[theme.base, theme.accent, theme.accentSoft, theme.secondary].map((c, i) => (
        <span key={i} className="h-4 w-3" style={{ background: c }} />
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
  const updateSettings = useApp((s) => s.updateSettings)
  const agents = useAgents((s) => s.list)
  const assets = useData((s) => s.assets)
  const sounds = useMemo(() => assets.filter((a) => a.kind === 'audio'), [assets])
  const pictures = useMemo(() => assets.filter((a) => a.kind === 'image' || a.kind === 'video'), [assets])
  const [selected, setSelected] = useState<string | null>(initial === NEW ? NEW : (initial ?? settings?.defaultTheme ?? SEVEN_THEME.id))
  const theme = list.find((t) => t.id === selected) ?? null
  const editor = useAutosavedState<Draft | null>(
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
  const dirty = Boolean(draft && (selected === NEW || (theme && JSON.stringify(toDraft(theme)) !== JSON.stringify(draft))))

  useEffect(() => {
    useThemes.setState({ preview: dirty && draft ? { ...SEVEN_THEME, ...cleanTheme(draft, SEVEN_THEME), id: theme?.id ?? NEW, builtin: false, createdAt: 0, updatedAt: 0 } : null })
  }, [dirty, draft])
  useEffect(() => () => useThemes.setState({ preview: null }), [])

  const set = (patch: Partial<Draft>) => {
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
  const soundOptions = [{ value: '', label: 'None' }, ...sounds.map((a) => ({ value: a.id, label: a.name }))]
  const maker = draft?.createdBy ? (agents.find((a) => a.id === draft.createdBy)?.name ?? 'an agent') : null

  return (
    <Panel
      className="min-w-0 flex-1"
      title="Themes"
      meta={`${list.length}`}
      actions={
        <Button size="sm" variant="badge" icon={<Plus />} onClick={create}>
          New theme
        </Button>
      }
      bodyClassName="flex min-h-0 gap-3 p-3"
    >
      <div className="flex w-60 shrink-0 flex-col gap-0.5 overflow-y-auto">
        {selected === NEW && <div className="border-l-2 border-l-accent bg-accent/10 px-2 py-1.5 text-[13px] text-white">{draft?.name || 'New theme'}</div>}
        {list.map((t) => (
          <ListRow
            key={t.id}
            active={selected === t.id}
            onClick={() => setSelected(t.id)}
            onMenu={rowMenu('theme', t.id, t.name, () => setSelected(t.id))}
            icon={<Swatches theme={t} />}
            title={t.name}
            subtitle={`${t.builtin ? 'built in' : formatRelative(t.updatedAt)}${(settings?.defaultTheme ?? SEVEN_THEME.id) === t.id ? ' · default' : ''}`}
            tone="tag"
          />
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
        {!draft ? (
          <EmptyState title="No theme selected">Pick one on the left, or make a new one.</EmptyState>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10.5px] text-faint">
                {readOnly ? 'Built in: copy it to make your own.' : maker ? `Made by ${maker}.` : ''}
                {users.length ? ` Used by ${users.join(', ')}.` : ''}
              </span>
              <span className="ml-auto flex flex-wrap items-center gap-1.5">
                <MakeOrSaved made={selected !== NEW} saver={editor} what="theme" onMake={make} disabled={!draft.name.trim()} />
                {theme && !isDefault && (
                  <Button size="sm" variant="ghost" icon={<Star />} onClick={() => void updateSettings({ defaultTheme: theme.id })}>
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
            <div className="grid grid-cols-2 gap-x-5 gap-y-3">
              <Field label="Name">
                <Input value={draft.name} disabled={readOnly} onChange={(e) => set({ name: e.target.value })} />
              </Field>
              <Field label="Description">
                <Input value={draft.description} disabled={readOnly} onChange={(e) => set({ description: e.target.value })} />
              </Field>
            </div>
            <Section title="Colours">
              <div className="grid grid-cols-2 gap-x-5 gap-y-3">
                <ColorField label="Accent" value={draft.accent} disabled={readOnly} onChange={(accent) => set({ accent })} />
                <ColorField label="Soft accent (lines, labels)" value={draft.accentSoft} disabled={readOnly} onChange={(accentSoft) => set({ accentSoft })} />
                <ColorField label="Secondary" value={draft.secondary} disabled={readOnly} onChange={(secondary) => set({ secondary })} />
                <ColorField label="Base (darkest background)" value={draft.base} disabled={readOnly} onChange={(base) => set({ base })} />
              </div>
            </Section>
            <Section title="Sky and light">
              <div className="grid grid-cols-2 gap-x-5 gap-y-3">
                <Field label="Sky" hint="A soft sky behind everything, with a sun or moon.">
                  <Select value={draft.sky} disabled={readOnly} options={SKY_MODES.map((m) => ({ value: m, label: SKY_LABELS[m] }))} onChange={(v) => set({ sky: v as SkyMode })} />
                </Field>
                <Field label="Mood light" hint="A large, soft wash of colour from below.">
                  <div className="flex items-center gap-2">
                    <Toggle checked={Boolean(draft.light)} disabled={readOnly} onChange={(v) => set({ light: v ? { color: draft.accent, strength: 0.3 } : null })} label={draft.light ? 'On' : 'Off'} />
                    {draft.light && (
                      <input type="color" value={draft.light.color} disabled={readOnly} onChange={(e) => set({ light: { ...draft.light!, color: e.target.value } })} className="h-8 w-10 cursor-pointer border border-line/50 bg-transparent" />
                    )}
                  </div>
                </Field>
                {draft.light && (
                  <Field label={`Light strength ${Math.round(draft.light.strength * 100)}%`}>
                    <Slider value={Math.round(draft.light.strength * 100)} min={0} max={100} onChange={(v) => set({ light: { ...draft.light!, strength: v / 100 } })} />
                  </Field>
                )}
              </div>
            </Section>
            <AnimatedSection draft={draft} readOnly={readOnly} onChange={set} />
            <Section title="Background">
              <div className="grid grid-cols-2 gap-x-5 gap-y-3">
                <Field label="Picture or video">
                  <Select
                    value={draft.backdrop?.image ?? ''}
                    disabled={readOnly}
                    options={[{ value: '', label: 'None' }, ...pictures.map((a) => ({ value: a.id, label: a.name }))]}
                    onChange={(v) => {
                      const colors = draft.backdrop?.colors ?? []
                      set({ backdrop: v || colors.length || draft.backdrop?.slideshow ? { colors, image: v || null, slideshow: draft.backdrop?.slideshow ?? null, dim: draft.backdrop?.dim ?? 0.55 } : null })
                    }}
                  />
                </Field>
                <Field label="Colours (up to 4 make a gradient)">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(draft.backdrop?.colors ?? []).map((c, i) => (
                      <span key={i} className="flex items-center">
                        <input
                          type="color"
                          value={c.length === 7 ? c : '#000000'}
                          disabled={readOnly}
                          onChange={(e) => set({ backdrop: { ...draft.backdrop!, colors: draft.backdrop!.colors.map((x, j) => (j === i ? e.target.value : x)) } })}
                          className="h-8 w-9 cursor-pointer border border-line/50 bg-transparent"
                        />
                        {!readOnly && (
                          <button
                            onClick={() => {
                              const colors = draft.backdrop!.colors.filter((_, j) => j !== i)
                              set({ backdrop: colors.length || draft.backdrop!.image || draft.backdrop!.slideshow ? { ...draft.backdrop!, colors } : null })
                            }}
                            className="text-faint hover:text-alert"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </span>
                    ))}
                    {!readOnly && (draft.backdrop?.colors.length ?? 0) < 4 && (
                      <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => set({ backdrop: { colors: [...(draft.backdrop?.colors ?? []), draft.base], image: draft.backdrop?.image ?? null, slideshow: draft.backdrop?.slideshow ?? null, dim: draft.backdrop?.dim ?? 0 } })}>
                        Colour
                      </Button>
                    )}
                  </div>
                </Field>
                {draft.backdrop && (
                  <Field label={`Darken ${Math.round(draft.backdrop.dim * 100)}%`}>
                    <div className="flex items-center gap-3">
                      <Slider value={Math.round(draft.backdrop.dim * 100)} min={0} max={90} onChange={(v) => set({ backdrop: { ...draft.backdrop!, dim: v / 100 } })} />
                      {!readOnly && (
                        <Button size="sm" variant="ghost" icon={<X />} onClick={() => set({ backdrop: null })}>
                          Clear
                        </Button>
                      )}
                    </div>
                  </Field>
                )}
              </div>
            </Section>
            <Section title="Tabletop chat">
              <div className="grid grid-cols-2 gap-x-5 gap-y-3">
                <Field
                  label={`Unpinned chat fade ${Math.round((draft.chatFadeOpacity ?? SEVEN_THEME.chatFadeOpacity) * 100)}%`}
                  hint="Opacity of the chat stream in Tabletop mode when unpinned and not hovered or focused."
                >
                  <Slider
                    value={Math.round((draft.chatFadeOpacity ?? SEVEN_THEME.chatFadeOpacity) * 100)}
                    min={0}
                    max={100}
                    onChange={(v) => set({ chatFadeOpacity: v / 100 })}
                  />
                </Field>
              </div>
            </Section>
            <Section title="Music and sounds">
              <div className="grid grid-cols-2 gap-x-5 gap-y-3">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] text-dim">Music (loops in this order)</span>
                  <div className="max-h-48 overflow-y-auto border border-line/40 p-1.5">
                    {!sounds.length && <div className="px-1 text-[12px] text-faint">No sound files in Data yet.</div>}
                    {sounds.map((a) => (
                      <label key={a.id} className="flex items-center gap-2 px-1 py-0.5 text-[12.5px] text-white/85">
                        <input
                          type="checkbox"
                          disabled={readOnly}
                          checked={draft.music.includes(a.id)}
                          onChange={(e) => set({ music: e.target.checked ? [...draft.music, a.id] : draft.music.filter((m) => m !== a.id) })}
                          className="accent-[var(--color-accent)]"
                        />
                        <span className="truncate">{a.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <Field label={`Music volume ${Math.round(draft.volume * 100)}%`} hint="Relative to the volume on the bottom bar.">
                    <Slider value={Math.round(draft.volume * 100)} min={0} max={100} onChange={(v) => set({ volume: v / 100 })} />
                  </Field>
                  {(Object.keys(SOUND_LABELS) as ThemeSoundEvent[]).map((k) => (
                    <Field key={k} label={`Sound when ${SOUND_LABELS[k].toLowerCase()}`}>
                      <Select value={draft.sounds[k] ?? ''} disabled={readOnly} options={soundOptions} onChange={(v) => set({ sounds: { ...draft.sounds, [k]: v || null } })} />
                    </Field>
                  ))}
                </div>
              </div>
            </Section>
          </>
        )}
      </div>
    </Panel>
  )
}

function AnimatedSection({ draft, readOnly, onChange }: { draft: Draft; readOnly: boolean; onChange: (patch: Partial<Draft>) => void }) {
  const addonOn = useTools((s) => s.list.some((m) => m.id === BACKGROUND_MODULE && m.state === 'on'))
  const info = backgroundInfo(draft.effect)
  const options = [...CORE_EFFECTS.map((e) => ({ value: e.id, label: e.name })), ...(addonOn || info ? backgroundList().map((b) => ({ value: b.id, label: b.name })) : [])]
  const values = info ? effectSettingsFor(info, draft.effectSettings) : {}
  const setValue = (name: string, value: number | string) => onChange({ effectSettings: { ...draft.effectSettings, [name]: value } })
  const hint = info ? (addonOn ? info.description : 'The Backgrounds add-on is off, so this shows nothing until it is on.') : addonOn ? 'Off everywhere if animated backgrounds are off in Settings.' : 'Turn on the Backgrounds add-on in Tools for more.'
  return (
    <Section title="Animated background">
      <div className="grid grid-cols-2 gap-x-5 gap-y-3">
        <Field label="Background" hint={hint}>
          <Select value={draft.effect} disabled={readOnly} options={options} onChange={(v) => onChange({ effect: v, effectSettings: v === draft.effect ? draft.effectSettings : {} })} />
        </Field>
        {info && info.reactions.length > 0 && (
          <Field label="Reactions" hint="The agent plays these with cue. Try one here.">
            <div className="flex flex-wrap gap-1.5">
              {info.reactions.map((r) => (
                <Button key={r.name} size="sm" variant="secondary" icon={<Play />} title={r.description} onClick={() => runCue({ sound: null, flash: null, shake: false, reaction: r.name })}>
                  {r.name.replace(/_/g, ' ')}
                </Button>
              ))}
            </div>
          </Field>
        )}
        {info && <SettingControls specs={info.settings} values={values} readOnly={readOnly} onChange={(name, value) => setValue(name, value as number | string)} />}
      </div>
    </Section>
  )
}

export function ThemePicker({ value, onChange, inherit }: { value: string | null; onChange: (id: string | null) => void; inherit: string }) {
  const list = useThemes((s) => s.list)
  return <Select value={value ?? ''} options={[{ value: '', label: inherit }, ...list.map((t) => ({ value: t.id, label: t.name }))]} onChange={(v) => onChange(v || null)} />
}
