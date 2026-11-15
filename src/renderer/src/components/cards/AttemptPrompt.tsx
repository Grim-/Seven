import { useState } from 'react'
import { Play, X } from 'lucide-react'
import { Button } from '../ui'
import { LinkTextarea } from '../data/LinkTextarea'
import { Markdown } from '../chat/Markdown'

export function AttemptPrompt({ hint, playLabel, onGo, onCancel }: { hint?: string; playLabel: string; onGo: (said: string) => void; onCancel: () => void }) {
  const [said, setSaid] = useState('')
  const ready = said.trim() !== ''
  const go = () => ready && onGo(said.trim())
  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-cyan">What do you do?</span>
      <LinkTextarea
        autoFocus
        rows={4}
        value={said}
        placeholder="I hurl it at…"
        className="min-h-24 text-[15px]"
        onValue={setSaid}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' || e.shiftKey) return
          e.preventDefault()
          go()
        }}
      />
      {hint && <Markdown text={hint} className="text-[12px] leading-snug text-dim" />}
      <div className="flex items-center gap-2">
        <Button variant="primary" icon={<Play />} disabled={!ready} onClick={go}>
          {playLabel}
        </Button>
        <Button variant="ghost" icon={<X />} onClick={onCancel}>
          Cancel
        </Button>
        <span className="ml-auto font-mono text-[10px] tracking-[0.12em] text-faint phone:hidden">ENTER · ESC</span>
      </div>
    </div>
  )
}
