import { useState } from 'react'
import { Check } from 'lucide-react'
import { Button, Modal } from '../ui'
import { SaveLocationFields, type SaveLocation } from './SaveLocationFields'
import { answerPlace, useSaving, type Asking } from '../../lib/savePlace'

function SaveLocationModal({ asking }: { asking: Asking }) {
  const [value, setValue] = useState<SaveLocation>({ folder: asking.answer.folder, remember: true, tags: [] })
  const what = asking.answer.label.toLowerCase()
  const save = () => answerPlace(asking, { folder: value.folder.trim(), tags: value.tags }, value.remember)
  const cancel = () => answerPlace(asking, null, false)
  return (
    <Modal
      open
      title={`Where should new ${what} go?`}
      onClose={cancel}
      footer={
        <>
          <span className="flex-1" />
          <Button variant="ghost" onClick={cancel}>
            Cancel
          </Button>
          <Button variant="primary" icon={<Check />} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <div
        onKeyDown={(e) => {
          if (e.key !== 'Enter' || e.defaultPrevented || e.shiftKey) return
          e.preventDefault()
          save()
        }}
      >
        <SaveLocationFields value={value} onChange={setValue} rememberLabel={`Put new ${what} here from now on without asking`} />
      </div>
    </Modal>
  )
}

export function SaveLocationHost() {
  const next = useSaving((s) => s.queue[0])
  return next ? <SaveLocationModal key={next.id} asking={next} /> : null
}
