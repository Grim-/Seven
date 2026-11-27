import { useEffect } from 'react'
import { Trash2 } from 'lucide-react'
import type { Toolset } from '@shared/types'
import { engine } from '../../lib/ipc'
import { useTools } from '../../store/tools'
import { toast } from '../../store/toasts'
import { Button, Field, Input, Panel, Toggle, MakeOrSaved, useAutosavedState, confirmDelete } from '../ui'
import { failed } from '../../lib/notify'

export function ToolsetEditor({ toolset, onSaved, onDeleted }: { toolset: Toolset | null; onSaved: (t: Toolset) => void; onDeleted: () => void }) {
  const modules = useTools((s) => s.list)
  type Draft = { name: string; description: string; tools: string[] }
  const from = (t: Toolset | null): Draft => ({ name: t?.name ?? 'New toolset', description: t?.description ?? '', tools: t?.tools ?? [] })
  const editor = useAutosavedState<Draft>(from(toolset), (d) => engine('toolsets.save', { id: toolset?.id, ...d }), { when: (d) => Boolean(toolset && d.name.trim()) })
  useEffect(() => editor.reset(from(toolset)), [toolset?.id])
  const { name, description, tools } = editor.value
  const edit = (patch: Partial<Draft>) => editor.set((d) => ({ ...d, ...patch }))
  const setName = (v: string) => edit({ name: v })
  const setDescription = (v: string) => edit({ description: v })
  const setTools = (v: string[]) => edit({ tools: v })
  const toggle = (n: string, on: boolean) => setTools(on ? [...tools, n] : tools.filter((t) => t !== n))
  const make = () =>
    void engine('toolsets.save', { id: undefined, name, description, tools })
      .then((saved) => {
        onSaved(saved)
        toast.success('Toolset made', name)
      })
      .catch(failed('Could not make the toolset'))
  const remove = () =>
    toolset &&
    confirmDelete(`Delete ${toolset.name}?`, 'Agents using it lose these tools unless they also have the modules.', () => engine('toolsets.delete', { id: toolset.id }), () => onDeleted())
  const pickable = modules.filter((m) => !m.always && m.tools.length)
  return (
    <Panel
      className="min-w-0 flex-1"
      title={toolset ? toolset.name : 'New toolset'}
      meta={`${tools.length} tool${tools.length === 1 ? '' : 's'}`}
      actions={
        <>
          {toolset && (
            <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={remove}>
              Delete
            </Button>
          )}
          <MakeOrSaved made={Boolean(toolset)} saver={editor} what="toolset" onMake={make} />
        </>
      }
      bodyClassName="flex flex-col gap-4 overflow-y-auto p-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="What it's for">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </div>
      <div className="text-[12.5px] text-dim">Pick tools from any module. An agent with this toolset gets exactly these, plus the module help for each. Modules that are off add nothing until switched on.</div>
      {pickable.map((m) => {
        const all = m.tools.every((t) => tools.includes(t.name))
        return (
          <div key={m.id} className="border border-line/40 tone-panel-40 p-2.5">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-[13px] text-ink">{m.name}</span>
              {m.state !== 'on' && <span className="font-label text-[10px] caps text-accent">{m.state}</span>}
              <button
                onClick={() => setTools(all ? tools.filter((t) => !m.tools.some((x) => x.name === t)) : [...new Set([...tools, ...m.tools.map((x) => x.name)])])}
                className="ml-auto font-label text-[10px] caps-14 text-dim hover:text-ink"
              >
                {all ? 'None' : 'All'}
              </button>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-x-4 gap-y-1">
              {m.tools.map((t) => (
                <div key={t.name} className="flex items-start gap-2" title={t.description}>
                  <Toggle checked={tools.includes(t.name)} onChange={(v) => toggle(t.name, v)} />
                  <span className="min-w-0">
                    <span className="block font-ui text-[12px] text-ink">{t.name}</span>
                    <span className="block truncate text-[11px] text-faint">{t.description}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </Panel>
  )
}
