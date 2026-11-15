import { Button } from '../ui'
import { Markdown } from '../chat/Markdown'

export function NoteView({ text, empty, onClose }: { text: string; empty: string; onClose: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      {text ? <Markdown text={text} /> : <span className="text-[13px] text-faint">{empty}</span>}
      <Button variant="primary" className="self-end" onClick={onClose}>
        OK
      </Button>
    </div>
  )
}
