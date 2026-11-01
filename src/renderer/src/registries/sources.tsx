import { useState, type ComponentType } from 'react'
import { FileUp, Plus } from 'lucide-react'
import { hitDetail, type GatherItem, type LibraryHit } from '@shared/types'
import { Button, Input, SearchBox, Textarea } from '../components/ui'
import { engine, main } from '../lib/ipc'
import { toast } from '../store/toasts'
import { importPaths } from '../lib/importFiles'
import { errorText } from '../lib/format'

export interface SourceInputProps {
  onAdd: (item: GatherItem) => void
}

const inputs = new Map<string, ComponentType<SourceInputProps>>()

export function registerSourceInput(kind: string, component: ComponentType<SourceInputProps>): void {
  inputs.set(kind, component)
}

export function sourceInput(kind: string): ComponentType<SourceInputProps> | undefined {
  return inputs.get(kind)
}

function PasteInput({ onAdd }: SourceInputProps) {
  const [text, setText] = useState('')
  const [label, setLabel] = useState('')
  const add = () => {
    onAdd({ source: 'paste', title: `${label.trim() || 'Pasted text'} · ${text.length.toLocaleString()} characters`, data: { text } })
    setText('')
    setLabel('')
  }
  return (
    <div className="flex flex-col gap-1.5">
      <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="What this is (optional)" />
      <Textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste or type here. Add it, then paste the next section if there's more." />
      <div>
        <Button size="sm" variant="secondary" icon={<Plus />} disabled={!text.trim()} onClick={add}>
          Add this section
        </Button>
      </div>
    </div>
  )
}

function WebInput({ onAdd }: SourceInputProps) {
  const [url, setUrl] = useState('')
  const valid = /^https?:\/\/\S+$/.test(url.trim())
  return (
    <div className="flex gap-1.5">
      <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
      <Button size="sm" variant="secondary" icon={<Plus />} disabled={!valid} onClick={() => (onAdd({ source: 'web', title: url.trim(), data: { url: url.trim() } }), setUrl(''))}>
        Add
      </Button>
    </div>
  )
}

function LibraryInput({ onAdd }: SourceInputProps) {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<LibraryHit[]>([])
  const search = (q: string) => {
    setQuery(q)
    if (!q.trim()) return setHits([])
    void engine('library.find', { query: q, kind: null })
      .then((h) => setHits(h.slice(0, 12)))
      .catch(() => setHits([]))
  }
  return (
    <div className="flex flex-col gap-1.5">
      <SearchBox value={query} onChange={search} />
      <div className="flex max-h-48 flex-col overflow-y-auto">
        {hits.map((h) => (
          <button key={`${h.kind}/${h.id}`} onClick={() => onAdd({ source: 'library', title: h.title, data: { entry: `${h.kind}/${h.id}` } })} className="flex items-center gap-2 px-2 py-1 text-left text-[12.5px] text-white/85 hover:bg-accent/10">
            <span className="font-mono text-[10px] uppercase text-faint">{h.kind}</span>
            <span className="truncate">{h.title}</span>
            <span className="ml-auto truncate text-[11px] text-dim">{hitDetail(h)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function FileInput({ onAdd }: SourceInputProps) {
  const pick = async () => {
    const paths = await main('dialog.openFiles')
    if (!paths.length) return
    try {
      for (const a of await importPaths(paths)) onAdd({ source: 'file', title: a.name, data: { assetId: a.id } })
    } catch (err) {
      toast.error('Could not add the file', errorText(err))
    }
  }
  return (
    <div>
      <Button size="sm" variant="secondary" icon={<FileUp />} onClick={() => void pick()}>
        Choose text files…
      </Button>
    </div>
  )
}

registerSourceInput('paste', PasteInput)
registerSourceInput('web', WebInput)
registerSourceInput('library', LibraryInput)
registerSourceInput('file', FileInput)
