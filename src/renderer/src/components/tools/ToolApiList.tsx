import { useState } from 'react'
import { Braces, ChevronDown, ChevronRight, Copy, Pencil, RotateCcw } from 'lucide-react'
import type { ModuleInfo, ModuleToolInfo, ToolParamDoc, ToolPermission } from '@shared/types'
import { Button, Select, Textarea } from '../ui'
import { copyText } from '../../lib/notify'
import { errorText } from '../../lib/format'
import { engine } from '../../lib/ipc'
import { toast } from '../../store/toasts'
import { useTools } from '../../store/tools'

const PERMISSION_LABEL: Record<ToolPermission, string> = {
  none: 'never asks',
  ask: 'asks unless Trusted',
  always: 'always asks',
  custom: 'asks when needed'
}

const CHOICE_PREVIEW_LIMIT = 14

function permissionOptions(def: ToolPermission): { value: string; label: string }[] {
  const label = (p: ToolPermission, text: string) => (def === p ? `${text} (default)` : text)
  return [
    ...(def === 'custom' ? [{ value: 'custom', label: 'Default (asks when needed)' }] : []),
    { value: 'none', label: label('none', 'Never asks') },
    { value: 'ask', label: label('ask', 'Asks unless Trusted') },
    { value: 'always', label: label('always', 'Always asks') }
  ]
}

async function runToolOp<T>(label: string, task: Promise<T>): Promise<T | null> {
  try {
    return await task
  } catch (err) {
    toast.error(label, errorText(err))
    return null
  }
}

function ParamNode({ param, depth = 0 }: { param: ToolParamDoc; depth?: number }) {
  const [allChoices, setAllChoices] = useState(false)
  const choices = param.choices ?? []
  const shownChoices = allChoices ? choices : choices.slice(0, CHOICE_PREVIEW_LIMIT)
  const hiddenCount = choices.length - shownChoices.length

  return (
    <div className={depth > 0 ? 'ml-3 border-l border-line/40 pl-3 pt-1.5' : 'py-2'}>
      <div className="flex flex-wrap items-baseline gap-2 font-mono text-[11.5px]">
        <span className="font-semibold text-white">{param.name}</span>
        {param.required ? (
          <span className="border border-accent/50 bg-accent/10 px-1 py-0.5 text-[9.5px] uppercase tracking-[0.08em] text-accent">
            required
          </span>
        ) : (
          <span className="border border-line/40 px-1 py-0.5 text-[9.5px] uppercase tracking-[0.08em] text-faint">
            optional
          </span>
        )}
        <span className="text-accent-soft">{param.type}</span>
        {param.nullable && <span className="text-faint">| null</span>}
      </div>

      {param.description && <p className="mt-1 text-[12px] text-dim">{param.description}</p>}

      {shownChoices.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1 font-mono text-[10.5px]">
          <span className="mr-1 text-[9.5px] uppercase tracking-[0.1em] text-faint">Choices:</span>
          {shownChoices.map((choice) => (
            <span key={choice} className="border border-line/45 bg-black/35 px-1.5 py-0.5 text-white/85">
              {choice}
            </span>
          ))}
          {hiddenCount > 0 && (
            <button
              type="button"
              className="px-1.5 py-0.5 text-accent-soft underline decoration-accent/40 underline-offset-2 hover:text-accent"
              onClick={() => setAllChoices(true)}
            >
              +{hiddenCount} more
            </button>
          )}
          {allChoices && choices.length > CHOICE_PREVIEW_LIMIT && (
            <button
              type="button"
              className="px-1.5 py-0.5 text-faint underline underline-offset-2 hover:text-white"
              onClick={() => setAllChoices(false)}
            >
              show less
            </button>
          )}
        </div>
      )}

      {param.children && param.children.length > 0 && (
        <div className="mt-1 flex flex-col gap-0.5">
          {param.children.map((child) => (
            <ParamNode key={`${param.name}.${child.name}`} param={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

function ToolCard({
  module,
  tool,
  open,
  onToggle
}: {
  module: ModuleInfo
  tool: ModuleToolInfo
  open: boolean
  onToggle: () => void
}) {
  const [showSchema, setShowSchema] = useState(false)
  const [editingDesc, setEditingDesc] = useState(false)
  const [descDraft, setDescDraft] = useState(tool.description)
  const [savingDesc, setSavingDesc] = useState(false)

  const defPerm = tool.defaultPermission ?? tool.permission
  const permOverridden = tool.permission !== defPerm
  const defDesc = tool.defaultDescription ?? tool.description
  const descOverridden = tool.description !== defDesc

  const startEditDesc = () => {
    setDescDraft(tool.description)
    setEditingDesc(true)
  }

  const saveDesc = async (value: string | null) => {
    setSavingDesc(true)
    const next = await runToolOp(
      'Could not update tool description',
      engine('tools.customize', { id: module.id, patch: { toolDescriptions: { [tool.name]: value } } })
    )
    setSavingDesc(false)
    if (next) {
      useTools.getState().setList(next)
      setEditingDesc(false)
    }
  }

  return (
    <div className="flex flex-col border border-line/45 bg-black/25">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={open}
        >
          <span className="text-faint">{open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}</span>
          <span className="truncate font-mono text-[12.5px]">
            <span className="font-semibold text-accent">{tool.name}</span>
            <span className="text-dim">(</span>
            {tool.params.map((p, i) => (
              <span key={p.name}>
                {i > 0 && <span className="text-faint">, </span>}
                <span className={p.required ? 'text-white/90' : 'text-dim'}>
                  {p.name}
                  {!p.required && '?'}
                </span>
              </span>
            ))}
            <span className="text-dim">)</span>
          </span>
        </button>

        <div className="flex flex-wrap items-center gap-1.5">
          {descOverridden && (
            <span className="border border-accent/40 bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-accent-soft">
              Edited
            </span>
          )}
          <span className="border border-line/40 px-1.5 py-0.5 font-mono text-[10px] text-faint">
            {tool.params.length === 1 ? '1 param' : `${tool.params.length} params`}
          </span>
          <div className="w-48 max-w-full">
            <Select
              aria-label={`Permission for ${tool.name}`}
              value={tool.permission}
              options={permissionOptions(defPerm)}
              onChange={(v) => {
                const next = v as ToolPermission
                void runToolOp(
                  'Could not update permission',
                  engine('tools.setPermission', { id: module.id, tool: tool.name, permission: next === defPerm ? null : next })
                ).then((updated) => {
                  if (updated) useTools.getState().setList(updated)
                })
              }}
              className={permOverridden ? 'h-7 border-accent/60 font-mono text-[11px] text-accent' : 'h-7 font-mono text-[11px] text-dim'}
            />
          </div>
          {permOverridden && (
            <Button
              size="sm"
              variant="ghost"
              icon={<RotateCcw />}
              title={`Reset permission to default (${PERMISSION_LABEL[defPerm]})`}
              aria-label={`Reset ${tool.name} permission to default`}
              onClick={() =>
                void runToolOp(
                  'Could not reset permission',
                  engine('tools.setPermission', { id: module.id, tool: tool.name, permission: null })
                ).then((updated) => {
                  if (updated) useTools.getState().setList(updated)
                })
              }
            />
          )}
        </div>
      </div>

      <div className="border-t border-line/25 px-3 py-2">
        {editingDesc ? (
          <div className="flex flex-col gap-2">
            <Textarea
              rows={2}
              value={descDraft}
              onChange={(e) => setDescDraft(e.target.value)}
              className="font-mono text-[12px]"
            />
            <div className="flex flex-wrap items-center gap-1.5">
              <Button size="sm" variant="primary" disabled={savingDesc} onClick={() => void saveDesc(descDraft)}>
                Save description
              </Button>
              <Button size="sm" variant="ghost" disabled={savingDesc} onClick={() => setEditingDesc(false)}>
                Cancel
              </Button>
              {descOverridden && (
                <Button size="sm" variant="ghost" icon={<RotateCcw />} disabled={savingDesc} onClick={() => void saveDesc(null)}>
                  Reset default
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <p className="text-[12.5px] text-white/80">
              {tool.description || <span className="italic text-faint">No description.</span>}
            </p>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                icon={<Pencil />}
                title="Edit tool description"
                aria-label={`Edit description for ${tool.name}`}
                onClick={startEditDesc}
              />
              {descOverridden && (
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<RotateCcw />}
                  title="Reset description to default"
                  aria-label={`Reset description for ${tool.name}`}
                  onClick={() => void saveDesc(null)}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {open && (
        <div className="flex flex-col gap-2 border-t border-line/35 bg-black/30 px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
              Parameters & API Schema
            </span>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                icon={<Copy />}
                onClick={() => void copyText(tool.signature, 'Signature copied', tool.signature)}
              >
                Copy signature
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={<Braces />}
                onClick={() => setShowSchema((s) => !s)}
              >
                {showSchema ? 'Hide JSON' : 'Raw JSON'}
              </Button>
            </div>
          </div>

          {tool.params.length === 0 ? (
            <span className="font-mono text-[11.5px] text-faint">Takes no parameters.</span>
          ) : (
            <div className="flex flex-col divide-y divide-line/25">
              {tool.params.map((p) => (
                <ParamNode key={p.name} param={p} />
              ))}
            </div>
          )}

          {showSchema && (
            <pre className="max-h-72 overflow-auto border border-line/40 bg-black/50 p-2.5 font-mono text-[11px] leading-relaxed text-white/80">
              {JSON.stringify(tool.schema, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

export function ToolApiList({ module }: { module: ModuleInfo }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const isExpanded = (name: string) => expanded[name] ?? true
  const allOpen = module.tools.length > 0 && module.tools.every((t) => isExpanded(t.name))

  const toggleAll = () => {
    const nextState = !allOpen
    setExpanded(Object.fromEntries(module.tools.map((t) => [t.name, nextState])))
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-accent-soft">
            Tool API & Permissions
          </span>
          {module.tools.length > 0 && (
            <span className="border border-line/45 px-1.5 py-0.5 font-mono text-[10px] text-faint">
              {module.tools.length}
            </span>
          )}
        </div>

        {module.tools.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            <Button size="sm" variant="ghost" onClick={toggleAll}>
              {allOpen ? 'Collapse all' : 'Expand all'}
            </Button>
            {module.tools.length > 1 &&
              (['none', 'ask', 'always'] as const).map((p) => (
                <Button
                  key={p}
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void runToolOp('Could not update permissions', engine('tools.setModulePermission', { id: module.id, permission: p })).then((next) => {
                      if (next) useTools.getState().setList(next)
                    })
                  }
                >
                  All: {p === 'none' ? 'Never' : p === 'ask' ? 'Ask' : 'Always'}
                </Button>
              ))}
            {module.tools.some((t) => t.permission !== (t.defaultPermission ?? t.permission)) && (
              <Button
                size="sm"
                variant="ghost"
                icon={<RotateCcw />}
                onClick={() =>
                  void runToolOp('Could not reset permissions', engine('tools.setModulePermission', { id: module.id, permission: null })).then((next) => {
                    if (next) useTools.getState().setList(next)
                  })
                }
              >
                Reset perms
              </Button>
            )}
          </div>
        )}
      </div>

      {module.tools.length === 0 ? (
        <span className="text-[12.5px] text-dim">
          {module.state === 'on' ? 'This module exposes no tool calls.' : 'Tool call signatures load once the module is switched on.'}
        </span>
      ) : (
        <div className="flex flex-col gap-2">
          {module.tools.map((t) => (
            <ToolCard
              key={t.name}
              module={module}
              tool={t}
              open={isExpanded(t.name)}
              onToggle={() => setExpanded((prev) => ({ ...prev, [t.name]: !isExpanded(t.name) }))}
            />
          ))}
        </div>
      )}
    </div>
  )
}
