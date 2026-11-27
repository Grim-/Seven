import { useState } from 'react'
import { Check, Trash2, Unlink } from 'lucide-react'
import { referencesIn } from '@shared/text'
import { Button, Popover } from '../ui'
import { LinkTextarea } from './LinkTextarea'

export function LinkFix({ link, onFix, onRemove }: { link: string; onFix: (to: string) => void; onRemove: () => void }) {
  const [text, setText] = useState('')
  const picked = referencesIn(text)[0] ?? null
  const apply = (close: () => void) => {
    if (!picked) return
    onFix(picked.link)
    setText('')
    close()
  }
  return (
    <Popover
      title={`Fix ${link}`}
      align="start"
      className="w-[min(26rem,92vw)] p-3"
      triggerClassName="inline-flex items-center border border-alert/50 bg-alert/10 p-1 text-alert hover:border-alert"
      trigger={<Unlink className="h-3 w-3" />}
    >
      {(close) => (
        <div className="flex flex-col gap-2">
          <LinkTextarea
            autoFocus
            rolls={false}
            rows={1}
            value={text}
            onValue={setText}
            placeholder="@…"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                apply(close)
              }
            }}
            className="min-h-0 resize-none"
          />
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              icon={<Trash2 />}
              onClick={() => {
                onRemove()
                close()
              }}
            >
              Remove
            </Button>
            <Button size="sm" variant="primary" icon={<Check />} disabled={!picked} onClick={() => apply(close)}>
              Relink everywhere
            </Button>
          </div>
        </div>
      )}
    </Popover>
  )
}
