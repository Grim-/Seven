import { useRef, useState } from 'react'
import { Save, Upload } from 'lucide-react'
import { showName } from '@shared/ids'
import { engine } from '../../lib/ipc'
import { errorText } from '../../lib/format'
import { copyText } from '../../lib/notify'
import { useBusy } from '../../lib/useBusy'
import { toast } from '../../store/toasts'
import { AlertBox, Button, Modal, ShellTabs, Textarea } from '../ui'

export type ImportType = 'workouts' | 'exercises'

interface ImportKind {
  tab: string
  title: string
  about: string
  placeholder: string
  button: string
  copied: string
  format: () => Promise<string>
  save: (json: string) => Promise<[string, string]>
}

const KINDS: Record<ImportType, ImportKind> = {
  workouts: {
    tab: 'Workouts',
    title: 'Add workouts from JSON',
    about: 'Workouts with their exercises and any before and after notes. Exercises you already have are reused by name; new ones are made.',
    placeholder: '{"workouts": [{"label": "...", "exercises": [...]}]}',
    button: 'Add',
    copied: 'Paste it into any LLM to get workouts back',
    format: () => engine('workout.workoutsFormat'),
    save: async (json) => {
      const made = await engine('workout.saveWorkouts', { json })
      return [made.length === 1 ? 'Workout added' : 'Workouts added', made.map(showName).join(', ')]
    }
  },
  exercises: {
    tab: 'Exercises',
    title: 'Add exercises from JSON',
    about: 'Exercises on their own. One you already have (same name) is left as it is.',
    placeholder: '{"exercises": [{"name": "...", "how": [...]}]}',
    button: 'Add',
    copied: 'Paste it into any LLM to get exercises back',
    format: () => engine('workout.exercisesFormat'),
    save: async (json) => {
      const { added, existing } = await engine('workout.saveExercises', { json })
      return ['Exercises added', `${added.length} added${existing.length ? `, ${existing.length} already there` : ''}`]
    }
  }
}

export function JsonImporter({ initial = 'workouts', onClose }: { initial?: ImportType; onClose: () => void }) {
  const [type, setType] = useState<ImportType>(initial)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, run] = useBusy()
  const file = useRef<HTMLInputElement>(null)
  const kind = KINDS[type]
  const load = (f: File | undefined) => {
    if (!f) return
    void f.text().then(setText, (err) => setError(errorText(err)))
  }
  const save = () => {
    setError(null)
    void run(
      async () => {
        const [title, detail] = await kind.save(text)
        toast.success(title, detail)
        onClose()
      },
      (err) => setError(errorText(err))
    )
  }
  return (
    <Modal
      open
      title={kind.title}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" icon={<Upload />} onClick={() => file.current?.click()}>
            Load a file…
          </Button>
          <span className="flex-1" />
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon={<Save />} disabled={busy || !text.trim()} onClick={save}>
            {kind.button}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <ShellTabs
          value={type}
          onChange={(v) => {
            setType(v as ImportType)
            setError(null)
          }}
          options={(Object.keys(KINDS) as ImportType[]).map((k) => ({ value: k, label: KINDS[k].tab }))}
        />
        <div className="text-[12.5px] text-dim">
          Paste JSON written by an LLM, or load a .json file. {kind.about}{' '}
          <button className="text-accent hover:text-white" onClick={() => void kind.format().then((f) => copyText(f, 'Copied', kind.copied))}>
            Copy the format for an LLM
          </button>
        </div>
        <Textarea mono value={text} onChange={(e) => setText(e.target.value)} placeholder={kind.placeholder} className="min-h-[46vh]" />
        <input ref={file} type="file" accept=".json,application/json,text/plain" className="hidden" onChange={(e) => load(e.target.files?.[0])} />
        {error && <AlertBox>{error}</AlertBox>}
      </div>
    </Modal>
  )
}
