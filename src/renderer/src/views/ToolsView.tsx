import { CORE_MODULES } from '@shared/toolnames'
import { Fragment, useMemo, useState } from 'react'
import { Boxes, FileArchive, FolderOpen, Import, Plus, Power, Puzzle, RefreshCw } from 'lucide-react'
import type { ModuleInfo, ModuleState } from '@shared/types'
import { BackBar, Button, Field, Input, KindShell, Modal, Panel, SettingCard, SaveState, Select, StatusBadge, Textarea, Toggle, ViewHeader, useDraft, type ShellItem, type Tone } from '../components/ui'
import { engine, main } from '../lib/ipc'
import { errorText } from '../lib/format'
import { toast } from '../store/toasts'
import { useTools } from '../store/tools'
import { ToolsetEditor } from '../components/tools/Toolsets'
import { useToolsets } from '../store/toolsets'
import { ToolFolders } from '../components/tools/ToolFolders'
import { useViewPlace } from '../lib/viewPlace'
import { installZip } from '../components/tools/installZip'
import { pickFolder } from '../components/ui/FileField'
import { kindModuleLists } from '../registries/kinds'

const STATE: Record<ModuleState, { label: string; tone: Tone }> = {
  on: { label: 'On', tone: 'ok' },
  off: { label: 'Off', tone: 'idle' },
  'needs-enabling': { label: 'Not enabled', tone: 'warn' },
  changed: { label: 'Changed', tone: 'warn' },
  error: { label: 'Error', tone: 'error' },
  loading: { label: 'Starting', tone: 'busy' },
  'missing-dependency': { label: 'Needs another module', tone: 'warn' }
}

const PERMISSION_LABEL: Record<string, string> = { none: 'never asks', ask: 'asks unless Trusted', always: 'always asks', custom: 'asks when needed' }

async function run<T>(label: string, task: Promise<T>): Promise<T | null> {
  try {
    return await task
  } catch (err) {
    toast.error(label, errorText(err))
    return null
  }
}

function SettingsForm({ module }: { module: ModuleInfo }) {
  const { draft: values, change: setValues, status, error } = useDraft<Record<string, unknown>>(module.values, (v) => engine('tools.settings', { id: module.id, values: v }), { delay: 1000 })
  return (
    <div className="flex flex-col gap-3">
      {module.settings.map((s) => (
        <Field key={s.name} label={s.label} hint={s.description}>
          {s.type === 'boolean' ? (
            <Toggle checked={values[s.name] === true} onChange={(v) => setValues({ ...values, [s.name]: v })} label={values[s.name] === true ? 'On' : 'Off'} />
          ) : s.type === 'folder' ? (
            <div className="flex gap-2">
              <Input value={values[s.name] === undefined || values[s.name] === null ? '' : String(values[s.name])} onChange={(e) => setValues({ ...values, [s.name]: e.target.value })} className="flex-1 font-mono text-[12.5px]" />
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  pickFolder((folder) => setValues({ ...values, [s.name]: folder }))
                }
              >
                Choose…
              </Button>
            </div>
          ) : (
            <Input
              type={s.secret ? 'password' : s.type === 'number' ? 'number' : 'text'}
              value={values[s.name] === undefined || values[s.name] === null ? '' : String(values[s.name])}
              onChange={(e) => setValues({ ...values, [s.name]: e.target.value })}
              className="font-mono text-[12.5px]"
            />
          )}
        </Field>
      ))}
      <SaveState status={status} error={error} />
    </div>
  )
}

function Detail({ module }: { module: ModuleInfo }) {
  const state = STATE[module.state]
  const adds = [
    ...module.adds,
    ...kindModuleLists().flatMap((g) => {
      const items = g.list.ofModule(module.id)
      return items.length ? [{ label: g.label, items }] : []
    })
  ]
  const enable = () => void run('Could not switch on', engine('tools.enable', { id: module.id }))
  return (
    <Panel
      className="flex-1"
      title={module.name}
      meta={`${module.id} · v${module.version}`}
      bodyClassName="flex flex-col gap-4 overflow-y-auto"
      actions={
        <>
          <StatusBadge tone={state.tone}>{state.label}</StatusBadge>
          {module.state === 'on' || module.state === 'loading' ? (
            <Button size="sm" variant="secondary" icon={<Power />} onClick={() => void run('Could not switch off', engine('tools.disable', { id: module.id }))}>
              Switch off
            </Button>
          ) : (
            module.state !== 'error' && (
              <Button size="sm" variant="primary" icon={<Power />} onClick={enable}>
                {module.state === 'changed' ? 'Switch on again' : 'Switch on'}
              </Button>
            )
          )}
          <Button size="sm" variant="ghost" icon={<RefreshCw />} onClick={() => void run('Could not reload', engine('tools.reload', { id: module.id }))}>
            Reload
          </Button>
          {module.dir && (
            <Button size="sm" variant="ghost" icon={<FolderOpen />} onClick={() => void run('Could not open', main('folder.open', { path: module.dir }))}>
              Folder
            </Button>
          )}
        </>
      }
    >
      {module.description && <p className="text-[13px] text-white/85">{module.description}</p>}
      {module.dependencies.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 font-mono text-[11.5px]">
          <span className="uppercase tracking-[0.14em] text-faint">Requires</span>
          {module.dependencies.map((dep) => (
            <span key={dep} className={module.missingDependencies.includes(dep) ? 'border border-accent/60 px-1.5 text-accent' : 'border border-line/50 px-1.5 text-white/85'}>
              {dep}
            </span>
          ))}
        </div>
      )}
      {adds.length > 0 && (
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[11.5px]">
          <span className="col-span-2 uppercase tracking-[0.14em] text-faint">Adds</span>
          {adds.map((a) => (
            <Fragment key={a.label}>
              <span className="text-accent-soft">{a.label}</span>
              <span className="text-white/85">{a.items.join(' · ')}</span>
            </Fragment>
          ))}
        </div>
      )}
      {module.state === 'missing-dependency' && (
        <div className="flex flex-wrap items-center gap-2 border border-accent/40 bg-accent/[0.06] px-3 py-2 text-[12.5px] text-white/90">
          <span>Inactive until these are on: {module.missingDependencies.join(', ')}.</span>
          {module.missingDependencies.map((dep) => (
            <Button key={dep} size="sm" variant="primary" icon={<Power />} onClick={() => void run('Could not switch on', engine('tools.enable', { id: dep }))}>
              Switch on {dep}
            </Button>
          ))}
        </div>
      )}
      {module.error && <div className="border border-alert/50 border-l-2 border-l-alert bg-alert/5 px-3 py-2 font-mono text-[12px] text-alert">{module.error}</div>}
      {module.state === 'needs-enabling' && (
        <div className="border border-accent/40 bg-accent/[0.06] px-3 py-2 text-[12.5px] text-white/90">
          This module runs code inside Seven. Check what it does, then switch it on. If its files change later it pauses until you switch it on again.
        </div>
      )}
      {module.state === 'changed' && (
        <div className="flex flex-col gap-1.5 border border-accent/40 bg-accent/[0.06] px-3 py-2 text-[12.5px] text-white/90">
          <span>The module's files changed since you switched it on, so it is paused. Check the changes, then switch it on again.</span>
          <ul className="font-mono text-[11.5px] text-accent">
            {module.changedFiles.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}
      {module.mcp && (
        <div className="grid grid-cols-[120px_1fr] gap-y-1 font-mono text-[12px]">
          <span className="text-faint">Transport</span>
          <span className="text-white/90">{module.mcp.transport}</span>
          <span className="text-faint">Server</span>
          <span className="break-all text-white/90">{module.mcp.target}</span>
          <span className="text-faint">Connection</span>
          <span className="text-white/90">{module.mcp.status}</span>
        </div>
      )}
      <div>
        <div className="mb-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-accent-soft">Tools</div>
        {module.tools.length === 0 ? (
          <span className="text-[12.5px] text-dim">{module.state === 'on' ? 'No tools.' : 'Tools show here once the module is on.'}</span>
        ) : (
          <div className="flex flex-col divide-y divide-line/30 border border-line/40">
            {module.tools.map((t) => (
              <div key={t.name} className="flex flex-col gap-0.5 px-3 py-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[12.5px] font-semibold text-accent">{t.name}</span>
                  <span className="ml-auto font-mono text-[10.5px] uppercase tracking-wider text-faint">{PERMISSION_LABEL[t.permission] ?? t.permission}</span>
                </div>
                {t.description && <span className="line-clamp-2 text-[12px] text-dim">{t.description}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
      {module.settings.length > 0 && (
        <div>
          <div className="mb-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-accent-soft">Settings</div>
          <SettingsForm key={module.id} module={module} />
        </div>
      )}
      {(module.actions ?? []).length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-accent-soft">Actions</div>
          {module.actions.map((a) => (
            <ActionButton key={a.name} module={module} name={a.name} label={a.label} description={a.description} />
          ))}
        </div>
      )}
    </Panel>
  )
}

function ActionButton({ module, name, label, description }: { module: ModuleInfo; name: string; label: string; description?: string }) {
  const [busy, setBusy] = useState(false)
  const go = async () => {
    setBusy(true)
    try {
      const result = await engine('tools.action', { id: module.id, name })
      toast.success(label, result.message ?? 'Done')
    } catch (err) {
      toast.error(`${label} failed`, errorText(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Field label={label} hint={description}>
      <div>
        <Button size="sm" variant="secondary" disabled={busy || module.state !== 'on'} onClick={() => void go()}>
          {busy ? 'Working… (this can take a few minutes)' : module.state === 'on' ? label : 'Switch on first'}
        </Button>
      </div>
    </Field>
  )
}

function NewModule({ onClose }: { onClose: () => void }) {
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'tools' | 'mcp'>('tools')
  const create = async () => {
    const done = await run('Could not create', engine('tools.create', { id, name, kind }))
    if (done) {
      toast.success('Module created', kind === 'mcp' ? 'Edit module.json with the server command, then switch it on.' : 'Edit index.js, then switch it on.')
      onClose()
    }
  }
  return (
    <Modal
      open
      title="New module"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!id.trim()} onClick={() => void create()}>
            Create
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Id" hint="Folder name: lower-case letters, numbers and -">
          <Input value={id} onChange={(e) => setId(e.target.value.toLowerCase())} placeholder="my-tools" />
        </Field>
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My tools" />
        </Field>
        <Field label="Kind">
          <Select
            value={kind}
            options={[
              { value: 'tools', label: 'JavaScript tools (index.js)' },
              { value: 'mcp', label: 'MCP server' }
            ]}
            onChange={(v) => setKind(v as 'tools' | 'mcp')}
          />
        </Field>
      </div>
    </Modal>
  )
}

function ImportMcp({ onClose }: { onClose: () => void }) {
  const [json, setJson] = useState('')
  const go = async () => {
    const result = await run('Import failed', engine('tools.importMcp', { json }))
    if (!result) return
    toast.success('Imported', `${result.created.length} server(s) added${result.skipped.length ? `, skipped ${result.skipped.join(', ')}` : ''}. Switch them on to use them.`)
    onClose()
  }
  return (
    <Modal
      open
      title="Import MCP servers"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!json.trim()} onClick={() => void go()}>
            Import
          </Button>
        </>
      }
    >
      <Field label="mcp.json" hint='Paste a config in the usual format: {"mcpServers": {"name": {"command": "...", "args": [...]}}}. Each server becomes a folder in your tools folder.'>
        <Textarea rows={12} value={json} onChange={(e) => setJson(e.target.value)} className="font-mono text-[12px]" />
      </Field>
    </Modal>
  )
}

export function ToolsView() {
  const list = useTools((s) => s.list)
  const [selected, setSelected] = useViewPlace<string | null>('tools.selected', null)
  const [dialog, setDialog] = useState<'new' | 'import' | null>(null)
  const sets = useToolsets((s) => s.list)
  const [setId, setSetId] = useViewPlace<string | null>('tools.toolset', null)
  const current = list.find((m) => m.id === selected) ?? null

  const items = useMemo((): ShellItem[] => {
    const group = (m: ModuleInfo) => (CORE_MODULES.includes(m.id) && m.source === 'builtin' ? 1 : m.source === 'builtin' ? 2 : 3)
    return [
      ...sets.map((t) => ({ key: `t:${t.id}`, title: t.name, subtitle: `${t.tools.length} tools`, icon: <Boxes className="h-4 w-4" />, tag: 'TOOLSET', group: 0 })),
      ...list.map((m) => ({
        key: `m:${m.id}`,
        title: m.name,
        subtitle: `${m.kind === 'mcp' ? 'mcp · ' : ''}${m.tools.length} tool${m.tools.length === 1 ? '' : 's'}`,
        excerpt: m.description,
        icon: <Puzzle className="h-4 w-4" />,
        tag: STATE[m.state].label.toUpperCase(),
        group: group(m)
      }))
    ]
  }, [list, sets])

  return (
    <div className="flex h-full flex-col gap-3 p-5">
      <ViewHeader
        title="Tools"
        subtitle="Every tool comes from a module folder. Drop a folder into your tools folder, or add an MCP server, then switch it on and pick it for an agent."
        actions={
          <>
            <Button variant="secondary" icon={<FileArchive />} onClick={() => void installZip(setSelected)}>
              Install from zip
            </Button>
            <Button variant="secondary" icon={<Import />} onClick={() => setDialog('import')}>
              Import mcp.json
            </Button>
            <Button variant="primary" icon={<Plus />} onClick={() => setDialog('new')}>
              New module
            </Button>
          </>
        }
      />
      <SettingCard className="shrink-0">
        <ToolFolders />
      </SettingCard>
      {setId ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <BackBar onBack={() => setSetId(null)} kind="Toolsets" />
          <ToolsetEditor toolset={sets.find((t) => t.id === setId) ?? null} onSaved={(t) => setSetId(t.id)} onDeleted={() => setSetId(null)} />
        </div>
      ) : current ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <BackBar onBack={() => setSelected(null)} kind="Tools" />
          <Detail key={current.id} module={current} />
        </div>
      ) : (
        <KindShell
          id="tools"
          layouts={['cards', 'deck', 'list']}
          items={items}
          groups={[
            { label: 'Toolsets', note: 'Bundles of tools you give agents.', adds: [{ label: 'New toolset', icon: <Plus />, onClick: () => setSetId('new') }] },
            { label: 'Core', note: "The heart of Seven: the Library (pages and every kind) and Mind (memory and reasoning). Without them it's just a place to run models." },
            { label: 'Built in' },
            { label: 'Your tools folder' }
          ]}
          onOpen={(item) => (item.key.startsWith('t:') ? setSetId(item.key.slice(2)) : setSelected(item.key.slice(2)))}
          empty="Seven could not find any tool modules."
        />
      )}
      {dialog === 'new' && <NewModule onClose={() => setDialog(null)} />}
      {dialog === 'import' && <ImportMcp onClose={() => setDialog(null)} />}
    </div>
  )
}
