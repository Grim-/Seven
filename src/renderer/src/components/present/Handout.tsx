import { useState, type ComponentType } from 'react'
import { Check, NotebookPen } from 'lucide-react'
import {
  handoutMarkdown,
  handoutOf,
  type Handout as HandoutData,
  type HandoutStyle
} from '@shared/handouts'
import { registerPresentation, type PresentationProps } from '../../registries/presentations'
import { Markdown } from '../chat/Markdown'
import { AreaMedia } from '../pictures/AreaLayer'
import { Button } from '../ui'
import { engine } from '../../lib/ipc'
import { useBusy } from '../../lib/useBusy'
import { toast } from '../../store/toasts'

const JOURNAL = 'Journal'

function Letter({ h }: { h: HandoutData }) {
  return (
    <div className="handout-letter">
      {h.title && <div className="mb-3 italic">{h.title}</div>}
      {h.image && (
        <AreaMedia
          id={h.image}
          className="mb-3 block max-h-56 w-auto border border-shade/20 sepia-[0.35]"
        />
      )}
      <Markdown text={h.text} />
      <div className="mt-4 flex items-end justify-between gap-4">
        <span className="handout-seal" />
        {h.from && <span className="italic">— {h.from}</span>}
      </div>
    </div>
  )
}

function Note({ h }: { h: HandoutData }) {
  return (
    <div className="handout-shadow">
      <div className="handout-note">
        <span className="handout-pin" />
        {h.title && (
          <div className="mb-1.5 font-semibold underline decoration-current/30 underline-offset-4">
            {h.title}
          </div>
        )}
        {h.image && <AreaMedia id={h.image} className="mb-2 block max-h-40 w-auto" />}
        <Markdown text={h.text} />
        {h.from && <div className="mt-2 text-right">— {h.from}</div>}
      </div>
    </div>
  )
}

function Poster({ h }: { h: HandoutData }) {
  return (
    <div className="handout-poster">
      {h.title && <div className="handout-poster-title">{h.title}</div>}
      {h.image && (
        <AreaMedia
          id={h.image}
          className="mx-auto my-3 block max-h-64 w-auto border border-ink/30 grayscale-[0.3] contrast-125"
        />
      )}
      <div className="text-[13px] leading-relaxed text-ink/85">
        <Markdown text={h.text} />
      </div>
      {h.from && (
        <div className="mt-3 font-label text-[11px] caps-20 text-accent">
          {h.from}
        </div>
      )}
    </div>
  )
}

function Terminal({ h }: { h: HandoutData }) {
  return (
    <div className="handout-terminal">
      {h.title && <div className="mb-2 font-bold text-ink">// {h.title}</div>}
      {h.image && (
        <AreaMedia
          id={h.image}
          className="mb-2 block max-h-48 w-auto border border-secondary-ink/40 opacity-90 hue-rotate-[140deg] saturate-50"
        />
      )}
      <div className="handout-typed">
        <Markdown text={h.text} />
      </div>
      {h.from && <div className="mt-2 text-secondary-ink/60">-- {h.from}</div>}
      <span className="handout-cursor" />
    </div>
  )
}

const STYLES: Record<HandoutStyle, ComponentType<{ h: HandoutData }>> = {
  letter: Letter,
  note: Note,
  poster: Poster,
  terminal: Terminal
}

function Handout({ fields, draft }: PresentationProps) {
  const h = handoutOf(fields)
  const [kept, setKept] = useState(false)
  const [busy, run] = useBusy()
  const Look = STYLES[h.style]
  if (!h.text) return null
  const keep = () =>
    void run(async () => {
      await engine('data.pages.append', { ref: JOURNAL, text: handoutMarkdown(h) })
      setKept(true)
      toast.success('Kept', `Added to your ${JOURNAL} page.`)
    }, `Could not add it to ${JOURNAL}`)
  return (
    <div className="my-3 flex max-w-xl flex-col gap-2">
      <div className={draft ? undefined : `handout-in-${h.style}`}>
        <Look h={h} />
      </div>
      <div className="flex items-center gap-2">
        <span className="font-label text-[10px] caps-16 text-faint">
          {h.style}
        </span>
        <span className="flex-1" />
        <Button
          size="sm"
          variant="badge"
          icon={kept ? <Check /> : <NotebookPen />}
          disabled={draft || busy || kept}
          onClick={keep}
        >
          {kept ? 'In your journal' : 'Keep in journal'}
        </Button>
      </div>
    </div>
  )
}

registerPresentation('handout', Handout)
