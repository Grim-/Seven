import { registerPresentation, type PresentationProps } from '../../registries/presentations'

function Aside({ fields }: PresentationProps) {
  const text = typeof fields.text === 'string' ? fields.text.trim() : ''
  if (!text) return null
  return (
    <aside className="my-2 ml-4 flex max-w-xl gap-2.5 border-l-2 border-accent/40 py-0.5 pl-3">
      <span className="shrink-0 pt-0.5 font-label text-[9.5px] font-bold caps-20 text-faint">aside</span>
      <span className="text-[13px] italic leading-relaxed text-dim">{text}</span>
    </aside>
  )
}

registerPresentation('aside', Aside)
