import { useEffect, useState } from 'react'
import { ClipboardCopy, Download, MessageSquare, MessageSquarePlus } from 'lucide-react'
import { toId } from '@shared/ids'
import type { ExportFormat, ExportInfo } from '@shared/exporting'
import { AlertBox, Button, Eyebrow, Modal, Segmented, Toggle, openMenu } from '../ui'
import { MarkdownEditor } from '../data/MarkdownEditor'
import { engine, main } from '../../lib/ipc'
import { useViewPlace } from '../../lib/viewPlace'
import { errorText } from '../../lib/format'
import { copyText, failed } from '../../lib/notify'
import { toast } from '../../store/toasts'
import { useAgents } from '../../store/agents'
import { referenceInChat, startChatWith } from '../../lib/conversation'
import { cn } from '../../lib/cn'
import { closeExport, useExport } from './exportStore'

const FORMATS: { value: ExportFormat; label: string }[] = [
  { value: 'markdown', label: 'Markdown' },
  { value: 'text', label: 'Plain text' },
  { value: 'json', label: 'JSON' }
]

const EXT: Record<ExportFormat, string> = { markdown: 'md', text: 'txt', json: 'json' }

export function ExportHost() {
  const request = useExport((s) => s.request)
  if (!request) return null
  return (
    <ExportModal
      key={`${request.source}|${JSON.stringify(request.args)}`}
      source={request.source}
      args={request.args}
    />
  )
}

function ExportModal({ source, args }: { source: string; args: Record<string, string> }) {
  const agents = useAgents((s) => s.list)
  const [info, setInfo] = useState<ExportInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [options, setOptions] = useState<Record<string, string>>({})
  const [sections, setSections] = useState<string[] | null>(null)
  const [brief, setBrief] = useState('')
  const [preset, setPreset] = useState<string | null>(null)
  const [format, setFormat] = useState<ExportFormat>('markdown')
  const [prefixKind, setPrefixKind] = useViewPlace('export.prefixKind', false)
  const [preview, setPreview] = useState<{ title: string; text: string } | null>(null)

  useEffect(() => {
    let live = true
    engine('export.describe', { source, args, options })
      .then((next) => {
        if (!live) return
        setInfo(next)
        setError(null)
        setSections((s) => s ?? next.sections.filter((x) => x.on).map((x) => x.id))
      })
      .catch((err) => live && setError(errorText(err)))
    return () => {
      live = false
    }
  }, [source, args, options])

  const choice = { source, args, options, sections: sections ?? [], brief, format }
  useEffect(() => {
    if (!sections) return
    let live = true
    const wait = window.setTimeout(() => {
      engine('export.build', choice)
        .then((built) => live && (setPreview(built), setError(null)))
        .catch((err) => live && setError(errorText(err)))
    }, 200)
    return () => {
      live = false
      window.clearTimeout(wait)
    }
  }, [source, args, options, sections, brief, format])

  const build = () => engine('export.build', choice)
  const finish = (send: (text: string) => void) =>
    void build()
      .then(({ text }) => {
        send(text)
        closeExport()
      })
      .catch(failed('Could not build it'))
  const save = () =>
    void build()
      .then(async ({ title, text }) => {
        const base = prefixKind && args.kind ? `${args.kind}_${toId(title) || title}` : title
        const path = await main('dialog.saveText', { name: `${base}.${EXT[format]}`, text })
        if (path) toast.success('Saved', path)
      })
      .catch(failed('Could not save'))
  const pickPreset = (id: string) => {
    const p = info?.presets.find((x) => x.id === id)
    if (!p) return
    setPreset(id)
    setBrief(p.brief)
    setSections(p.sections)
  }
  const toggle = (id: string, on: boolean) =>
    setSections((s) => (on ? [...(s ?? []), id] : (s ?? []).filter((x) => x !== id)))
  const text = preview?.text ?? ''

  return (
    <Modal
      open
      wide
      title={info ? `Hand to an agent · ${info.title}` : 'Hand to an agent'}
      onClose={closeExport}
      bodyClassName="flex min-h-0 flex-1 flex-col"
      footer={
        <>
          <Button variant="ghost" icon={<Download />} onClick={save}>
            Save to a file
          </Button>
          <Button
            variant="ghost"
            icon={<ClipboardCopy />}
            onClick={() => finish((t) => void copyText(t, 'Copied', preview?.title ?? ''))}
          >
            Copy
          </Button>
          <span className="flex-1" />
          <Button variant="ghost" icon={<MessageSquare />} onClick={() => finish(referenceInChat)}>
            Put in the chat box
          </Button>
          <Button
            variant="primary"
            icon={<MessageSquarePlus />}
            disabled={!agents.length}
            onClick={(e) =>
              openMenu(
                e,
                'Start a chat with',
                agents.map((a) => ({
                  label: a.name,
                  onSelect: () => finish((t) => startChatWith(a.id, t))
                }))
              )
            }
          >
            Start a chat with…
          </Button>
        </>
      }
    >
      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(20rem,24rem)_minmax(0,1fr)]">
        <div className="flex min-h-0 flex-col overflow-y-auto border-b border-line/60 md:border-b-0 md:border-r">
          <div className="flex flex-col gap-2 border-b border-line/40 px-4 py-3">
            <Eyebrow>What do you want help with</Eyebrow>
            <MarkdownEditor
              compact
              value={brief}
              onValue={setBrief}
              placeholder="Say what you want the agent to do with this. It goes at the top."
              className="min-h-[5.5rem]"
            />
            {info && info.presets.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {info.presets.map((p) => (
                  <Button
                    key={p.id}
                    size="sm"
                    variant={preset === p.id ? 'primary' : 'ghost'}
                    title="Fills in a starting brief and ticks what that job needs"
                    onClick={() => pickPreset(p.id)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
          {info?.options.map((o) => (
            <div key={o.id} className="flex flex-col gap-2 border-b border-line/40 px-4 py-3">
              <Eyebrow>{o.label}</Eyebrow>
              <Segmented
                value={o.value}
                options={o.choices}
                onChange={(v) => setOptions({ ...options, [o.id]: v })}
              />
            </div>
          ))}
          <div className="flex flex-col px-4 py-3">
            <Eyebrow>Include</Eyebrow>
            {info?.sections.map((s) => (
              <div
                key={s.id}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 border-b border-line/20 py-2 last:border-b-0"
              >
                <Toggle
                  checked={sections?.includes(s.id) ?? s.on}
                  onChange={(on) => toggle(s.id, on)}
                />
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-ink">{s.label}</span>
                  <span className="block text-[11.5px] text-faint">{s.hint}</span>
                </span>
                <span className="whitespace-nowrap font-ui text-[11px] text-dim">{s.size}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex min-h-0 min-w-0 flex-col">
          <div className="flex flex-wrap items-center gap-3 border-b border-line/40 px-4 py-2">
            <Segmented value={format} options={FORMATS} onChange={setFormat} />
            {args.kind && <Toggle checked={prefixKind} onChange={setPrefixKind} label="Prefix filename with kind" />}
            {info && <span className="text-[12px] text-faint">{info.subtitle}</span>}
            <span className="ml-auto font-ui text-[11.5px] text-dim">
              {text.length.toLocaleString()} characters ·{' '}
              {text ? text.split('\n').length.toLocaleString() : 0} lines
            </span>
          </div>
          {error && <AlertBox className="m-3">{error}</AlertBox>}
          <pre
            className={cn(
              'min-h-[20rem] flex-1 overflow-auto whitespace-pre-wrap px-4 py-3 font-ui text-[12px] leading-relaxed text-ink/85',
              !preview && 'text-faint'
            )}
          >
            {preview ? text : 'Building…'}
          </pre>
        </div>
      </div>
    </Modal>
  )
}
