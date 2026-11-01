import { useRef, useState } from 'react'
import { Check, FileUp } from 'lucide-react'
import { compendiumInfo, type CompendiumKind } from '@shared/compendium'
import { Button, Modal, Textarea } from '../ui'
import { engine } from '../../lib/ipc'
import { errorText } from '../../lib/format'
import { useBusy } from '../../lib/useBusy'
import { toast } from '../../store/toasts'

const EXAMPLE = '[{"name": "Shadow Blade", "facts": {"level": 2, "school": "Illusion"}, "text": "What it does"}]'

export function CompendiumImporter({ kind, onClose }: { kind: CompendiumKind; onClose: () => void }) {
  const info = compendiumInfo(kind)
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<{ added: string[]; replaced: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, run] = useBusy()
  const file = useRef<HTMLInputElement>(null)
  const check = (apply: boolean) => {
    setError(null)
    void run(async () => {
      try {
        const result = await engine('dnd.import', { kind, json: text, apply })
        if (!apply) return setPreview(result)
        toast.success(`${info?.plural ?? kind} imported`, `${result.added.length} added, ${result.replaced.length} replaced`)
        onClose()
      } catch (err) {
        setError(errorText(err))
      }
    })
  }
  const edit = (value: string) => {
    setText(value)
    setPreview(null)
  }
  return (
    <Modal
      open
      title={`Import ${info?.plural.toLowerCase() ?? kind}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {preview ? (
            <Button variant="primary" icon={<Check />} disabled={busy} onClick={() => check(true)}>
              Import {preview.added.length + preview.replaced.length}
            </Button>
          ) : (
            <Button variant="primary" disabled={busy || !text.trim()} onClick={() => check(false)}>
              Check
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <div className="text-[12.5px] text-dim">A JSON list in Seven's shape (name, facts, text) or the 5e-database shape. Entries with the same name as one you have, or an SRD one, replace it.</div>
        <Textarea value={text} onChange={(e) => edit(e.target.value)} rows={10} placeholder={EXAMPLE} className="font-mono text-[12px]" />
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" icon={<FileUp />} onClick={() => file.current?.click()}>
            Load a file
          </Button>
          <input ref={file} type="file" accept=".json,application/json" className="hidden" onChange={(e) => void e.target.files?.[0]?.text().then(edit)} />
        </div>
        {error && <div className="text-[12.5px] text-alert">{error}</div>}
        {preview && (
          <div className="flex flex-col gap-1 border border-line/40 bg-black/40 px-3 py-2 text-[12.5px]">
            <span className="text-ok">{preview.added.length} new{preview.added.length ? `: ${preview.added.slice(0, 12).join(', ')}${preview.added.length > 12 ? '…' : ''}` : ''}</span>
            <span className={preview.replaced.length ? 'text-accent' : 'text-dim'}>{preview.replaced.length} replaced{preview.replaced.length ? `: ${preview.replaced.slice(0, 12).join(', ')}${preview.replaced.length > 12 ? '…' : ''}` : ''}</span>
          </div>
        )}
      </div>
    </Modal>
  )
}
