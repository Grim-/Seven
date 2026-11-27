import { useCallback, useEffect, useState } from 'react'
import { Copy, RefreshCw, RotateCcw, Save } from 'lucide-react'
import type { ModuleInfo } from '@shared/types'
import { Markdown } from '../chat/Markdown'
import { Button, Field, Input, Textarea } from '../ui'
import { copyText } from '../../lib/notify'
import { noteFailure } from '../../store/problems'
import { errorText } from '../../lib/format'
import { engine } from '../../lib/ipc'
import { toast } from '../../store/toasts'
import { useTools } from '../../store/tools'

export function ModuleGuideView({ module }: { module: ModuleInfo }) {
  const [markdown, setMarkdown] = useState('')
  const [live, setLive] = useState(false)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const result = await engine('tools.guide', { id: module.id }).catch(
      noteFailure('tools', `Could not generate documentation for ${module.name}`, () => null)
    )
    setLoading(false)
    if (result) {
      setMarkdown(result.markdown)
      setLive(result.live)
    }
  }, [module.id, module.name])

  useEffect(() => {
    void load()
  }, [load, module.state, module.name, module.description, module.prompt, module.help, module.tools])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border border-line/40 tone-panel-25 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          <span
            className={
              live
                ? 'border border-accent/45 bg-accent/10 px-1.5 py-0.5 font-label text-[10px] caps-10 text-accent'
                : 'border border-line/50 px-1.5 py-0.5 font-label text-[10px] caps-10 text-faint'
            }
          >
            {live ? 'Live agent guide' : 'Offline preview'}
          </span>
          <span className="text-dim">
            Generated dynamically from the module's current tool APIs, prompt, and help text.
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" icon={<RefreshCw />} disabled={loading} onClick={() => void load()}>
            Refresh
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={<Copy />}
            disabled={!markdown}
            onClick={() => void copyText(markdown, 'Documentation copied', `${module.name} guide Markdown`)}
          >
            Copy Markdown
          </Button>
        </div>
      </div>

      {markdown ? (
        <div className="border border-line/45 tone-panel-30 px-4 py-3 text-[13px]">
          <Markdown text={markdown} />
        </div>
      ) : (
        <div className="border border-line/40 px-4 py-6 text-center text-[12.5px] text-dim">
          {loading ? 'Generating documentation…' : 'No documentation generated for this module.'}
        </div>
      )}
    </div>
  )
}

function ResetAside({ dirty, onReset }: { dirty: boolean; onReset: () => void }) {
  if (!dirty) return null
  return (
    <button
      type="button"
      onClick={onReset}
      className="inline-flex items-center gap-1 font-label text-[10px] caps-8 text-accent-soft hover:text-accent"
    >
      <RotateCcw className="h-2.5 w-2.5" />
      Reset
    </button>
  )
}

export function ModuleCustomEditor({ module }: { module: ModuleInfo }) {
  const [name, setName] = useState(module.name)
  const [description, setDescription] = useState(module.description)
  const [prompt, setPrompt] = useState(module.prompt)
  const [help, setHelp] = useState(module.help)
  const [remind, setRemind] = useState(module.remind)
  const [toolDescs, setToolDescs] = useState<Record<string, string>>(() =>
    Object.fromEntries(module.tools.map((t) => [t.name, t.description]))
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(module.name)
    setDescription(module.description)
    setPrompt(module.prompt)
    setHelp(module.help)
    setRemind(module.remind)
    setToolDescs(Object.fromEntries(module.tools.map((t) => [t.name, t.description])))
  }, [module.id, module.name, module.description, module.prompt, module.help, module.remind, module.tools])

  const hasUnsaved =
    name !== module.name ||
    description !== module.description ||
    prompt !== module.prompt ||
    help !== module.help ||
    remind !== module.remind ||
    module.tools.some((t) => (toolDescs[t.name] ?? t.description) !== t.description)

  const saveAll = async () => {
    setSaving(true)
    try {
      const next = await engine('tools.customize', {
        id: module.id,
        patch: {
          name,
          description,
          prompt,
          help,
          remind,
          toolDescriptions: toolDescs
        }
      })
      useTools.getState().setList(next)
      toast.success('Module customization saved', `${name.trim() || module.defaultName} updated live.`)
    } catch (err) {
      toast.error('Could not save customization', errorText(err))
    } finally {
      setSaving(false)
    }
  }

  const resetAll = async () => {
    setSaving(true)
    try {
      const next = await engine('tools.customize', {
        id: module.id,
        patch: {
          name: null,
          description: null,
          prompt: null,
          help: null,
          remind: null,
          toolDescriptions: null
        }
      })
      useTools.getState().setList(next)
      toast.success('Defaults restored', `${module.defaultName} reset to built-in text.`)
    } catch (err) {
      toast.error('Could not reset customization', errorText(err))
    } finally {
      setSaving(false)
    }
  }

  const discardDraft = () => {
    setName(module.name)
    setDescription(module.description)
    setPrompt(module.prompt)
    setHelp(module.help)
    setRemind(module.remind)
    setToolDescs(Object.fromEntries(module.tools.map((t) => [t.name, t.description])))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border border-line/40 tone-panel-25 px-3 py-2">
        <span className="text-[12px] text-dim">
          Customize how this module presents itself to you and agents. Tool names and parameter schemas come from code and stay locked.
        </span>
        <div className="flex items-center gap-1.5">
          {hasUnsaved && (
            <Button size="sm" variant="ghost" disabled={saving} onClick={discardDraft}>
              Discard
            </Button>
          )}
          {module.customized && (
            <Button size="sm" variant="ghost" icon={<RotateCcw />} disabled={saving} onClick={() => void resetAll()}>
              Reset all
            </Button>
          )}
          <Button size="sm" variant="primary" icon={<Save />} disabled={saving || !hasUnsaved} onClick={() => void saveAll()}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Display name" aside={<ResetAside dirty={name !== module.defaultName} onReset={() => setName(module.defaultName)} />}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={module.defaultName} />
        </Field>
        <Field
          label="Module summary"
          aside={<ResetAside dirty={description !== module.defaultDescription} onReset={() => setDescription(module.defaultDescription)} />}
        >
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short module description" />
        </Field>
      </div>

      <Field
        label="Agent prompt (prompt.md)"
        aside={<ResetAside dirty={prompt !== module.defaultPrompt} onReset={() => setPrompt(module.defaultPrompt)} />}
        hint="Instructions given to agents in their system prompt whenever this module is enabled for them."
      >
        <Textarea rows={6} value={prompt} onChange={(e) => setPrompt(e.target.value)} className="font-ui text-[12px]" />
      </Field>

      <Field
        label="Auto-generated guide notes (help.md)"
        aside={<ResetAside dirty={help !== module.defaultHelp} onReset={() => setHelp(module.defaultHelp)} />}
        hint="Additional Markdown section appended under ## More in the auto-generated documentation."
      >
        <Textarea rows={5} value={help} onChange={(e) => setHelp(e.target.value)} className="font-ui text-[12px]" />
      </Field>

      <Field
        label="Turn reminder (remind.md)"
        aside={<ResetAside dirty={remind !== module.defaultRemind} onReset={() => setRemind(module.defaultRemind)} />}
        hint="Short reminder injected into active turns when the module is active."
      >
        <Textarea rows={3} value={remind} onChange={(e) => setRemind(e.target.value)} className="font-ui text-[12px]" />
      </Field>

      {module.tools.length > 0 && (
        <div className="flex flex-col gap-2.5 border-t border-line/35 pt-3">
          <div className="font-label text-[10.5px] font-semibold caps-14 text-accent-soft">
            Tool Descriptions
          </div>
          <div className="flex flex-col gap-2.5">
            {module.tools.map((t) => {
              const defDesc = t.defaultDescription ?? t.description
              const val = toolDescs[t.name] ?? t.description
              return (
                <Field
                  key={t.name}
                  label={t.name}
                  aside={<ResetAside dirty={val !== defDesc} onReset={() => setToolDescs((prev) => ({ ...prev, [t.name]: defDesc }))} />}
                >
                  <Textarea
                    rows={2}
                    value={val}
                    onChange={(e) => setToolDescs((prev) => ({ ...prev, [t.name]: e.target.value }))}
                    className="font-ui text-[12px]"
                  />
                </Field>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
