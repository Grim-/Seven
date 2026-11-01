import { useState } from 'react'
import { Send } from 'lucide-react'
import { cn } from '../../lib/cn'
import { useBusy } from '../../lib/useBusy'
import { Button } from './Button'
import { Textarea } from './inputs'

interface MessageComposerProps {
  onSend: (text: string) => Promise<unknown>
  placeholder?: string
  label?: string
  error?: string
  className?: string
}

export function MessageComposer({ onSend, placeholder = 'Write a message...', label = 'Send', error = 'Could not send', className }: MessageComposerProps) {
  const [text, setText] = useState('')
  const [busy, run] = useBusy()
  const ready = Boolean(text.trim()) && !busy
  const send = () => {
    if (!ready) return
    void run(async () => {
      await onSend(text.trim())
      setText('')
    }, error)
  }
  return (
    <div className={cn('flex items-end gap-2', className)}>
      <Textarea
        rows={2}
        className="min-h-0 flex-1"
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            send()
          }
        }}
      />
      <Button variant="primary" icon={<Send />} disabled={!ready} onClick={send}>
        {label}
      </Button>
    </div>
  )
}
