import { CORE_MODULES, currentToolName } from '@shared/toolnames'
import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, FolderOpen, MessageSquarePlus, Plus, Shapes, Trash2, X } from 'lucide-react'
import { KindAccess } from '../components/agents/KindAccess'
import { DEFAULT_CONTEXT, DEFAULT_LIBRARY_ACCESS, PERMISSION_MODES, type ChatAccess, SAMPLING_KEYS, type AgentDraft, type AgentProfile, type PermissionMode, type PromptCost } from '@shared/types'
import { BackBar, Button, Field, Input, KindShell, Modal, NumberField, Panel, Select, Slider, Toggle, ViewHeader, useAutosave, MakeOrSaved } from '../components/ui'
import { engine, main } from '../lib/ipc'
import { DEFAULT_AGENT_ID, useAgents } from '../store/agents'
import { useVault } from '../store/vault'
import { isRunnable, modelName, useModels } from '../store/models'
import { toast } from '../store/toasts'
import { StylePicker } from '../components/mind/Styles'
import { MindView } from '../components/mind/Mind'
import { useTools } from '../store/tools'
import { AgentAvatar } from '../components/agents/look'
import { LookEditor } from '../components/agents/LookEditor'
import { WorldLink } from '../components/worlds/Worlds'
import { ThemePicker } from '../components/themes/Themes'
import { VoicePicker } from '../components/voice/VoicePicker'
import { agentGroups, useToolsets } from '../store/toolsets'
import { cn } from '../lib/cn'
import { LinkTextarea } from '../components/data/LinkTextarea'
import { failed } from '../lib/notify'
import { openChat } from '../lib/conversation'
import { openEntry } from '../lib/library'
import { useData } from '../store/data'
import { useKindInfos } from '../lib/kinds'
import { ThinkingSelect } from '../components/chat/ThinkingSelect'
import { ToolChoiceSelect } from '../components/chat/ToolChoiceSelect'
import { useViewPlace } from '../lib/viewPlace'

const BLANK: AgentDraft = { name: 'New agent', description: '', modelId: null, systemPrompt: '', sampling: {}, workspace: null, modules: [...CORE_MODULES, 'ui'], permissionMode: 'ask' }

function toDraft(agent: AgentProfile): AgentDraft {
  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    modelId: agent.modelId,
    systemPrompt: agent.systemPrompt,
    sampling: { ...agent.sampling },
    workspace: agent.workspace,
    modules: [...agent.modules],
    permissionMode: agent.permissionMode,
    context: { ...agent.context },
    look: { ...agent.look },
    world: agent.world ?? null,
    toolsets: [...(agent.toolsets ?? [])],
    private: agent.private === true,
    incognito: agent.incognito === true,
    roleplay: agent.roleplay === true,
    theme: agent.theme ?? null,
    voice: agent.voice ?? null,
    readAloud: agent.readAloud === true,
    offTools: [...(agent.offTools ?? [])],
    reasoningStyle: agent.reasoningStyle ?? null,
    thinking: agent.thinking ?? null,
    toolChoice: agent.toolChoice ?? null,
    mindAuto: agent.mindAuto,
    remindEvery: agent.remindEvery,
    maxToolRounds: agent.maxToolRounds,
    sheet: agent.sheet ?? null,
    player: agent.player ?? null,
    cards: agent.cards ?? null,
    library: { ...DEFAULT_LIBRARY_ACCESS, ...agent.library, hidden: [...(agent.library?.hidden ?? [])] }
  }
}

const CHAT_ACCESS: { value: ChatAccess; label: string }[] = [
  { value: 'none', label: 'No chats' },
  { value: 'own', label: 'Its own chats' },
  { value: 'all', label: 'Every chat' }
]

function LibraryAccessEditor({ draft, onChange }: { draft: AgentDraft; onChange: (d: AgentDraft) => void }) {
  const list = useKindInfos()
  const access = { ...DEFAULT_LIBRARY_ACCESS, ...draft.library }
  const hidden = new Set(access.hidden)
  const set = (kind: string, on: boolean) => {
    const next = new Set(hidden)
    if (on) next.delete(kind)
    else next.add(kind)
    onChange({ ...draft, library: { ...access, hidden: [...next] } })
  }
  return (
    <>
      <Field label="Chats" className="col-span-2" hint="Which past conversations this agent can find and read. Chats with vault agents stay hidden while the vault is locked.">
        <Select value={access.chats} options={CHAT_ACCESS} onChange={(v) => onChange({ ...draft, library: { ...access, chats: v as ChatAccess } })} />
      </Field>
      <Field label="Kinds it can see" className="col-span-2" hint="Turned off, the agent can't find, read or show that kind, and loses its tools. Its own memory is always its own.">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {list.map((k) => (
            <label key={k.kind} className="flex items-center gap-2 text-[13px] text-white/85" title={k.description}>
              <input type="checkbox" checked={!hidden.has(k.kind)} onChange={(e) => set(k.kind, e.target.checked)} className="accent-[var(--color-accent)]" />
              {k.label}
            </label>
          ))}
        </div>
      </Field>
    </>
  )
}

function tok(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

function usePromptCost(draft: AgentDraft): PromptCost | null {
  const [cost, setCost] = useState<PromptCost | null>(null)
  const hostState = useModels((s) => `${s.host.status}:${s.host.modelId ?? ''}`)
  const key = JSON.stringify([draft.id, draft.systemPrompt, draft.workspace, draft.modules, draft.toolsets])
  useEffect(() => {
    let live = true
    const timer = setTimeout(() => {
      engine('agents.promptCost', { draft })
        .then((c) => live && setCost(c))
        .catch(() => live && setCost(null))
    }, 400)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [key, hostState])
  return cost
}

function PromptCostLine({ cost }: { cost: PromptCost | null }) {
  if (!cost) return null
  const pre = cost.exact ? '' : '~'
  return (
    <div className="col-span-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 border border-line/40 bg-black/40 px-3 py-2 font-mono text-[11.5px] text-dim">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-accent-soft">Prompt size</span>
      <span>
        System prompt <span className="text-white">{pre}{tok(cost.system)}</span>
      </span>
      <span>
        Tools <span className="text-white">{pre}{tok(cost.tools)}</span>
      </span>
      <span>
        Total <span className="text-white">{pre}{tok(cost.total)}</span>
        {cost.contextSize ? ` of ${tok(cost.contextSize)} (${Math.round((cost.total / cost.contextSize) * 100)}%)` : ''}
      </span>
      <span className="text-faint">{cost.exact ? 'counted with the loaded model' : 'estimate; load a model for an exact count'}</span>
    </div>
  )
}

const SECTIONS_KEY = 'seven.agentSections'

function savedSections(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(SECTIONS_KEY) ?? '{}') as Record<string, boolean>
  } catch {
    return {}
  }
}

function EditorSection({ id, title, summary, isNew, defaultOpen = false, children }: { id: string; title: string; summary: string; isNew: boolean; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(() => isNew || (savedSections()[id] ?? defaultOpen))
  const toggle = () => {
    const next = !open
    setOpen(next)
    try {
      localStorage.setItem(SECTIONS_KEY, JSON.stringify({ ...savedSections(), [id]: next }))
    } catch {
      return
    }
  }
  return (
    <section className="border border-line/50 bg-black/30">
      <button onClick={toggle} className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-white/[0.02]">
        <ChevronRight className={cn('h-4 w-4 shrink-0 text-accent transition-transform', open && 'rotate-90')} />
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-white">{title}</span>
        {!open && <span className="min-w-0 flex-1 truncate text-[12px] text-dim">{summary}</span>}
      </button>
      {open && <div className="border-t border-line/40 p-3.5">{children}</div>}
    </section>
  )
}

function ToolsetPicker({ draft, onChange }: { draft: AgentDraft; onChange: (d: AgentDraft) => void }) {
  const sets = useToolsets((s) => s.list)
  const chosen = draft.toolsets ?? []
  return (
    <Field label="Toolsets" className="col-span-2" hint="Bundles of tools made in Tools. Modules below add whole modules on top.">
      {sets.length ? (
        <div className="flex flex-wrap gap-1.5">
          {sets.map((t) => {
            const on = chosen.includes(t.id)
            return (
              <button
                key={t.id}
                title={t.description || t.tools.join(', ')}
                onClick={() => onChange({ ...draft, toolsets: on ? chosen.filter((x) => x !== t.id) : [...chosen, t.id] })}
                className={cn('border px-2.5 py-1 text-[12.5px]', on ? 'border-accent bg-accent/10 text-accent' : 'border-line/50 text-dim hover:text-white')}
              >
                {t.name} <span className="font-mono text-[10px] text-faint">{t.tools.length}</span>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="text-[12px] text-faint">No toolsets yet. Make them in Tools.</div>
      )}
    </Field>
  )
}

function AgentEditor({ draft, onChange, onSaved }: { draft: AgentDraft; onChange: (d: AgentDraft) => void; onSaved: (a: AgentProfile) => void }) {
  const { save, remove } = useAgents()
  const autosave = useAutosave<AgentDraft>((d) => save(d))
  const change = (d: AgentDraft) => {
    onChange(d)
    if (d.id) autosave.queue(d)
  }
  const maker = useAgents((s) => {
    const by = s.list.find((a) => a.id === draft.id)?.createdBy
    return by ? (s.list.find((a) => a.id === by)?.name ?? 'another agent') : null
  })
  const vault = useVault((s) => s.status)
  const models = useModels((s) => s.list)
  const params = useModels((s) => s.params)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const modules = useTools((s) => s.list)
  const toolsetList = useToolsets((s) => s.list)
  const cost = usePromptCost(draft)
  const ctx = { ...DEFAULT_CONTEXT, ...draft.context }
  const setContext = (patch: Partial<typeof ctx>) => change({ ...draft, context: { ...draft.context, ...patch } })

  const modelOptions = useMemo(
    () => [{ value: '', label: 'Whichever model is loaded' }, ...models.filter(isRunnable).map((m) => ({ value: m.id, label: m.remote ? `${m.name} (remote: its chats leave this machine)` : m.name }))],
    [models]
  )
  const missingModel = draft.modelId && !models.some((m) => m.id === draft.modelId)

  const doSave = () =>
    save(draft).then(
      (saved) => {
        onSaved(saved)
        toast.success('Agent made', saved.name)
        return saved
      },
      (err) => {
        failed('Could not make the agent')(err)
        return null
      }
    )

  const folder = useAgents((st) => st.list.find((x) => x.id === draft.id)?.folder) ?? null
  const hasFolder = useData((st) => Boolean(folder && st.pages.some((p) => p.id === folder)))
  const chat = async () => {
    await autosave.flush()
    const saved = draft.id ? { id: draft.id } : await doSave()
    if (!saved) return
    openChat(null, saved.id)
  }

  return (
    <Panel
      className="flex-1"
      title={draft.id ? 'Edit agent' : 'New agent'}
      actions={
        <>
          {draft.id && draft.id !== DEFAULT_AGENT_ID && (
            <Button size="sm" variant="danger" icon={<Trash2 />} onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          )}
          {folder && hasFolder && (
            <Button size="sm" variant="ghost" icon={<FolderOpen />} onClick={() => openEntry('folder', folder)}>
              Open folder
            </Button>
          )}
          <Button size="sm" variant="badge" icon={<MessageSquarePlus />} onClick={() => void chat()}>
            Chat
          </Button>
          <MakeOrSaved made={Boolean(draft.id)} saver={autosave} what="agent" onMake={() => void doSave()} />
        </>
      }
      bodyClassName="overflow-y-auto"
    >
      <div className="flex w-full flex-col gap-3">
        <EditorSection id="identity" title="Identity" summary={draft.description ? `${draft.name} · ${draft.description}` : draft.name} isNew={!draft.id}>
        <div className="grid grid-cols-2 gap-x-5 gap-y-4">
        <Field label="Name">
          <Input value={draft.name} onChange={(e) => change({ ...draft, name: e.target.value })} />
        </Field>
        <Field label="Model" error={missingModel ? 'That model is no longer registered.' : null} hint="Loaded automatically when a chat with this agent starts.">
          <Select value={draft.modelId ?? ''} options={modelOptions} onChange={(v) => change({ ...draft, modelId: v || null })} />
        </Field>
        {maker && (
          <div className="col-span-2 border border-accent/40 bg-accent/5 px-3 py-2 text-[12.5px] text-white/85">
            Made by {maker}. It only gets the tools and permissions you give it here.
          </div>
        )}
        <Field label="Description" className="col-span-2">
          <Input value={draft.description} onChange={(e) => change({ ...draft, description: e.target.value })} placeholder="What this agent is for" />
        </Field>
        <Field label="Roleplay replies" className="col-span-2" hint="Dialogue shows with the speaker's picture, actions in their own style, narration as prose. The agent is told the format.">
          <Toggle checked={draft.roleplay === true} onChange={(v) => change({ ...draft, roleplay: v })} label={draft.roleplay ? 'On' : 'Off'} />
        </Field>
        <Field label="Incognito" className="col-span-2" hint="Its chats are kept in memory only: never saved, gone when Seven closes or the chat is deleted. It keeps no memories or thoughts, doesn't recall old ones, and its chats stay out of search, the timeline and the web log. Pages and files it makes when you ask are kept.">
          <Toggle checked={draft.incognito === true} onChange={(v) => change({ ...draft, incognito: v })} label={draft.incognito ? 'Incognito' : 'Off'} />
        </Field>
        {vault.configured && draft.id !== DEFAULT_AGENT_ID && (
          <Field label="Keep in the vault" className="col-span-2" hint={vault.unlocked ? 'Only listed while the vault is unlocked, and stored encrypted. Its chats blur while the vault is locked.' : 'Unlock the vault to change this.'}>
            <Toggle checked={draft.private === true} onChange={(v) => vault.unlocked && change({ ...draft, private: v })} label={draft.private ? 'In the vault' : 'Always listed'} />
          </Field>
        )}
        </div>
        </EditorSection>
        <EditorSection id="prompt" title="System prompt" summary={draft.systemPrompt ? draft.systemPrompt.slice(0, 100) : 'None'} isNew={!draft.id}>
          <div className="grid grid-cols-2 gap-x-5 gap-y-4">
            <Field label="System prompt" className="col-span-2" hint="The agent's standing instructions. Kept at the top of every conversation.">
              <LinkTextarea mono rolls={false} rows={14} value={draft.systemPrompt} onValue={(systemPrompt) => change({ ...draft, systemPrompt })} />
            </Field>
          </div>
        </EditorSection>
        <EditorSection id="mind" title="Mind" summary={agentGroups(draft, toolsetList, modules).includes('mind') ? 'Memories, thoughts, journal and reasoning style' : 'Memories, thoughts, journal and reasoning style (Mind is not turned on for this agent)'} isNew={!draft.id}>
            {!agentGroups(draft, toolsetList, modules).includes('mind') && <div className="mb-2 text-[12px] text-accent">Mind is not turned on for this agent, so it can't remember, recall, think or reason. Turn it on under Tools.</div>}
            <div className="mb-3 flex flex-col gap-2">
              <Toggle
                checked={draft.mindAuto?.recall !== false}
                onChange={(v) => change({ ...draft, mindAuto: { recall: v } })}
                label="Auto-recall: add memories that match each message to what the model sees"
              />
              <Field label="Check in every N turns" hint="Seven adds a check_in to the agent's context: each turned-on module's reminder, plus how long since it remembered, looked things up or reasoned, and which tools it used. 0 turns it off.">
                <NumberField value={draft.remindEvery ?? 5} min={0} max={100} step={1} onChange={(v) => change({ ...draft, remindEvery: v ?? 0 })} className="w-28" />
              </Field>
              {agentGroups(draft, toolsetList, modules).includes('mind') && <StylePicker value={draft.reasoningStyle ?? null} onChange={(reasoningStyle) => change({ ...draft, reasoningStyle })} />}
              <ThinkingSelect value={draft.thinking ?? null} fallback="the model's setting" hint="How much this agent's model thinks before replying, unless a chat picks otherwise. Token limits for each level are set per model in Models." onChange={(thinking) => change({ ...draft, thinking })} />
              <ToolChoiceSelect value={draft.toolChoice ?? null} fallback="Auto (Model decides)" hint="Optionally enforce that this agent calls a tool (such as reason) before it is allowed to generate speech or dialogue." onChange={(toolChoice) => change({ ...draft, toolChoice })} />
            </div>
            {draft.id && (
              <div className="flex h-[560px] min-h-0">
                <MindView agentId={draft.id} />
              </div>
            )}
          </EditorSection>

        <EditorSection id="look" title="Look" summary="Picture, theme, colours and background" isNew={!draft.id}>
        <div className="grid grid-cols-2 gap-x-5 gap-y-4">
        <Field label="Voice" className="col-span-2" hint="Used when its replies are read aloud and when it speaks in scenes.">
          <VoicePicker value={draft.voice ?? null} onChange={(voice) => change({ ...draft, voice })} inherit="Default voice" />
        </Field>
        <Field label="Read its replies aloud" className="col-span-2" hint="Only while voices are on (bottom bar). Any reply can also be read from its menu.">
          <Toggle checked={draft.readAloud === true} onChange={(v) => change({ ...draft, readAloud: v })} label={draft.readAloud ? 'On' : 'Off'} />
        </Field>
        <Field label="Theme" className="col-span-2" hint="The app's colours, sky, light and music while you're in this agent's chats. Make and edit themes in Data.">
          <ThemePicker value={draft.theme ?? null} onChange={(theme) => change({ ...draft, theme })} inherit="App default" />
        </Field>
        <LookEditor draft={draft} onChange={change} />
        </div>
        </EditorSection>

        <EditorSection id="tools" title="Tools" summary={`${(draft.toolsets ?? []).length} toolsets, ${draft.modules.length} modules`} isNew={!draft.id}>
        <div className="grid grid-cols-2 gap-x-5 gap-y-4">
        <ToolsetPicker draft={draft} onChange={change} />
        <Field label="Most tool rounds per reply" className="col-span-2" hint="How many times in a row the agent can call tools before Seven stops the reply. 0 means no limit. Applies to remote models and models run in llama-server.">
          <NumberField value={draft.maxToolRounds ?? 0} min={0} step={1} onChange={(v) => change({ ...draft, maxToolRounds: v ?? 0 })} className="w-28" />
        </Field>
        <Field label="Workspace" className="col-span-2" hint="The folder this agent's file tools work in. Paths outside it are refused.">
          <div className="flex gap-2">
            <Input readOnly value={draft.workspace ?? ''} placeholder="No workspace: file tools are off" className="font-mono text-[12.5px]" />
            <Button
              variant="badge"
              icon={<FolderOpen />}
              onClick={async () => {
                const folder = await main('dialog.openFolder')
                if (folder) change({ ...draft, workspace: folder })
              }}
            >
              Browse
            </Button>
            {draft.workspace && (
              <Button variant="ghost" icon={<X />} onClick={() => change({ ...draft, workspace: null })}>
                Clear
              </Button>
            )}
          </div>
        </Field>
        {agentGroups(draft, toolsetList, modules).includes('world') && <WorldLink value={draft.world} agentName={draft.name} onChange={(world) => change({ ...draft, world })} />}
        <PromptCostLine cost={cost} />
        <div className="col-span-2 flex flex-col gap-2.5">
          <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-accent-soft">Tools</span>
          {(() => {
            const ids = CORE_MODULES.filter((id) => modules.some((m) => m.id === id) && !draft.modules.includes(id))
            const names = ids.map((id) => modules.find((m) => m.id === id)?.name ?? id)
            const what = ids.map((id) => (id === 'mind' ? 'memory and reasoning' : 'pages and the Library'))
            return ids.length ? <div className="border border-line/50 border-l-2 border-l-accent bg-accent/5 px-3 py-2 text-[12px] text-dim">Core is off for this agent: {names.join(' and ')}. It can't use {what.join(' or ')}, which is most of what Seven is for.</div> : null
          })()}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(26rem,1fr))] gap-2">
          {[...modules.filter((m) => !m.always && CORE_MODULES.includes(m.id)).sort((a, b) => CORE_MODULES.indexOf(a.id) - CORE_MODULES.indexOf(b.id)), ...modules.filter((m) => !m.always && !CORE_MODULES.includes(m.id))].map((group) => {
            const on = draft.modules.includes(group.id)
            const blocked = group.needsWorkspace && !draft.workspace
            return (
              <div key={group.id} className="flex items-start gap-3 border border-line/40 bg-black/40 px-3 py-2">
                <Toggle
                  checked={on}
                  onChange={(v) => change({ ...draft, modules: v ? [...draft.modules, group.id] : draft.modules.filter((g) => g !== group.id) })}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-[13px] text-white">
                    {group.name}
                    {CORE_MODULES.includes(group.id) && <span className="border border-accent/60 bg-accent/10 px-1 font-mono text-[9.5px] uppercase text-accent">core</span>}
                    {group.kind === 'mcp' && <span className="border border-purple/40 px-1 font-mono text-[9.5px] uppercase text-purple">MCP</span>}
                    {group.source === 'user' && <span className="border border-line/60 px-1 font-mono text-[9.5px] uppercase text-faint">yours</span>}
                    {group.state !== 'on' && <span className="font-mono text-[10px] uppercase tracking-wider text-accent">{group.state === 'needs-enabling' ? 'not enabled in Tools' : group.state}</span>}
                    {cost?.modules[group.id] ? <span className="ml-auto font-mono text-[10.5px] text-faint">~{tok(cost.modules[group.id])} tokens</span> : null}
                  </div>
                  <div className="text-[12px] text-dim">
                    {group.description}
                    {on && blocked && <span className="text-accent"> Needs a workspace to take effect.</span>}
                  </div>
                  {on && group.tools.length > 1 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {group.tools.map((t) => {
                        const off = (draft.offTools ?? []).some((n) => currentToolName(n) === t.name)
                        return (
                          <button
                            key={t.name}
                            title={`${t.description}\n\n${off ? 'Off for this agent. Click to turn on.' : 'Click to turn off for this agent.'}`}
                            onClick={() => change({ ...draft, offTools: off ? (draft.offTools ?? []).filter((n) => currentToolName(n) !== t.name) : [...(draft.offTools ?? []), t.name] })}
                            className={cn('border px-1.5 py-0.5 font-mono text-[10.5px]', off ? 'border-line/40 text-faint line-through' : 'border-teal/40 text-teal hover:border-teal')}
                          >
                            {t.name}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          </div>
        </div>
        </div>
        </EditorSection>
        <EditorSection id="library" title="Library access" summary={`${CHAT_ACCESS.find((c) => c.value === (draft.library?.chats ?? DEFAULT_LIBRARY_ACCESS.chats))?.label}${draft.library?.hidden.length ? `, ${draft.library.hidden.length} kinds hidden` : ', every kind'}`} isNew={!draft.id}>
        <div className="grid grid-cols-2 gap-x-5 gap-y-4">
        <LibraryAccessEditor draft={draft} onChange={change} />
        </div>
        </EditorSection>
        <EditorSection id="permissions" title="Permissions" summary={PERMISSION_MODES.find((m) => m.id === draft.permissionMode)?.label ?? draft.permissionMode} isNew={!draft.id}>
        <div className="grid grid-cols-2 gap-x-5 gap-y-4">
        <Field
          label="Default permissions"
          className="col-span-2"
          hint={`${PERMISSION_MODES.find((m) => m.id === draft.permissionMode)?.description ?? ''} Each chat can change this from its header.`}
        >
          <Select
            value={draft.permissionMode}
            options={PERMISSION_MODES.map((m) => ({ value: m.id, label: m.label }))}
            onChange={(v) => change({ ...draft, permissionMode: v as PermissionMode })}
            className="w-48"
          />
        </Field>
        </div>
        </EditorSection>
        <EditorSection id="context" title="Memory and context" summary={`Tool output budget ${Math.round((draft.context?.outputShare ?? DEFAULT_CONTEXT.outputShare) * 100)}%`} isNew={!draft.id}>
        <div className="grid grid-cols-2 gap-x-5 gap-y-4">
        <Field
          label={`Tool output budget: ${Math.round((draft.context?.outputShare ?? DEFAULT_CONTEXT.outputShare) * 100)}% of the context`}
          className="col-span-2"
          hint="Longer tool results are cut to this size for the model; it can read the rest with read_kind. Lower keeps more history, higher shows more at once."
        >
          <div className="w-72">
            <Slider
              value={Math.round((draft.context?.outputShare ?? DEFAULT_CONTEXT.outputShare) * 100)}
              min={4}
              max={40}
              step={1}
              onChange={(v) => change({ ...draft, context: { ...draft.context, outputShare: v / 100 } })}
            />
          </div>
        </Field>
        <Field
          label={`Trim old tool output above ${Math.round(ctx.trimAt * 100)}%`}
          hint="Tool results older than the kept turns are removed from the model's context (it can read them again with read_kind)."
        >
          <Slider value={Math.round(ctx.trimAt * 100)} min={30} max={95} step={5} onChange={(v) => setContext({ trimAt: v / 100 })} />
        </Field>
        <Field label={`Keep the last ${ctx.keepTurns} turn${ctx.keepTurns > 1 ? 's' : ''} in full`} hint="Never trimmed or summarised.">
          <Slider value={ctx.keepTurns} min={1} max={10} step={1} onChange={(v) => setContext({ keepTurns: v })} />
        </Field>
        <Field
          label={`Summarise above ${Math.round(ctx.summaryAt * 100)}%`}
          hint="The oldest turns are replaced by a summary for the model. The chat itself keeps everything."
        >
          <Slider value={Math.round(ctx.summaryAt * 100)} min={40} max={98} step={1} onChange={(v) => setContext({ summaryAt: v / 100 })} />
        </Field>
        <Field label="Summaries" hint={ctx.autoSummary ? 'Written automatically when the threshold is reached.' : 'The chat asks before summarising.'}>
          <Toggle checked={ctx.autoSummary} onChange={(v) => setContext({ autoSummary: v })} label={ctx.autoSummary ? 'Automatic' : 'Ask first'} />
        </Field>
        </div>
        </EditorSection>
        <EditorSection id="sampling" title="Sampling overrides" summary={Object.keys(draft.sampling).length ? `${Object.keys(draft.sampling).length} set` : "Blank uses the model's setting"} isNew={!draft.id}>
        <div className="col-span-2 grid grid-cols-3 gap-x-5 gap-y-4">
          {SAMPLING_KEYS.map((key) => {
            const def = params.find((p) => p.key === key)
            if (!def) return null
            return (
              <Field key={key} label={def.label}>
                <NumberField
                  allowEmpty
                  value={draft.sampling[key]}
                  placeholder={`model (${String(def.default)})`}
                  min={def.min}
                  max={def.max}
                  step={def.step}
                  onChange={(v) => {
                    const sampling = { ...draft.sampling }
                    if (v === undefined) delete sampling[key]
                    else sampling[key] = v
                    change({ ...draft, sampling })
                  }}
                />
              </Field>
            )
          })}
        </div>
        </EditorSection>
      </div>
      <Modal
        open={confirmDelete}
        title="Delete agent"
        onClose={() => setConfirmDelete(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmDelete(false)
                if (draft.id) remove(draft.id, 'keep').catch(failed('Delete failed'))
              }}
            >
              Delete, keep its folder
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmDelete(false)
                if (draft.id) remove(draft.id, 'delete').catch(failed('Delete failed'))
              }}
            >
              Delete with its folder
            </Button>
          </>
        }
      >
        Delete "{draft.name}"? Chats that used it will fall back to the default agent. Its folder in Files, and everything in it, can be kept or deleted too.
      </Modal>
    </Panel>
  )
}

export function AgentsView() {
  const agents = useAgents((s) => s.list)
  const models = useModels((s) => s.list)
  const [draft, setDraftState] = useState<AgentDraft | null>(null)
  const [openId, setOpenId] = useViewPlace<string | null>('agents.selected', null)
  const setDraft = (d: AgentDraft | null) => {
    setDraftState(d)
    if ((d?.id ?? null) !== openId) setOpenId(d?.id ?? null)
  }
  useEffect(() => {
    if (draft || !openId) return
    const agent = agents.find((a) => a.id === openId)
    if (agent) setDraftState(toDraft(agent))
  }, [openId, agents])

  const focus = useAgents((s) => s.focus)
  const kindAccess = useAgents((s) => s.kindAccess)
  const showKinds = (on: boolean) => useAgents.setState({ kindAccess: on })
  useEffect(() => {
    if (!focus) return
    showKinds(false)
    const agent = agents.find((a) => a.id === focus)
    if (agent) setDraft(toDraft(agent))
    useAgents.setState({ focus: null })
  }, [focus, agents])

  useEffect(() => {
    if (draft?.id && !agents.some((a) => a.id === draft.id)) setDraft(null)
  }, [agents, draft])

  const newAgent = () => {
    showKinds(false)
    setDraft({ ...BLANK })
  }

  return (
    <div className="flex h-full flex-col gap-3 p-5">
      <ViewHeader
        title="Agents"
        subtitle="Profiles that set a model, instructions and sampling for a chat."
        actions={
          <>
            <Button variant={kindAccess ? 'primary' : 'ghost'} icon={<Shapes />} onClick={() => showKinds(!kindAccess)}>
              Kind access
            </Button>
            <Button variant="primary" icon={<Plus />} onClick={newAgent}>
              New agent
            </Button>
          </>
        }
      />
      {kindAccess ? (
        <KindAccess />
      ) : draft ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <BackBar onBack={() => setDraft(null)} kind="Agents" />
          <AgentEditor key={draft.id ?? 'new'} draft={draft} onChange={setDraft} onSaved={(a) => setDraft(toDraft(a))} />
        </div>
      ) : (
        <KindShell
          id="agents"
          layouts={['deck', 'cards', 'tiles', 'list']}
          items={agents.map((a) => ({
            key: a.id,
            title: a.name,
            subtitle: a.modelId ? `${modelName(models, a.modelId)}${models.find((m) => m.id === a.modelId)?.remote ? ' · remote' : ''}` : 'Loaded model',
            excerpt: a.description || 'No description',
            icon: <AgentAvatar agent={a} size={16} />,
            tile: <AgentAvatar agent={a} size={72} />,
            tag: a.private ? 'LOCKED' : 'AGENT',
            color: a.look.accent,
            updatedAt: a.updatedAt
          }))}
          onOpen={(item) => {
            const agent = agents.find((a) => a.id === item.key)
            if (agent) setDraft(toDraft(agent))
          }}
          adds={[{ label: 'New agent', icon: <Plus />, onClick: newAgent }]}
          empty="No agents yet."
        />
      )}
    </div>
  )
}
