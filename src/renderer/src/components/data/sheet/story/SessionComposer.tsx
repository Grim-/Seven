import type { StorySession } from '@shared/story'
import { Button, Modal } from '../../../ui'
import { SessionEditor } from './SessionEditor'

export function SessionComposer({ session, number, onChange, onSave, onClose }: { session: StorySession | null; number: number; onChange: (next: StorySession) => void; onSave: () => void; onClose: () => void }) {
  return (
    <Modal
      open={Boolean(session)}
      wide
      title={session?.phase === 'backstory' ? 'Add Backstory Chapter' : 'Log Scene or Interaction'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!session || (!session.title.trim() && !session.summary?.trim() && !session.notes.trim())} onClick={onSave}>
            Add to story
          </Button>
        </>
      }
    >
      {session && <SessionEditor session={session} number={number} onChange={(patch) => onChange({ ...session, ...patch })} />}
    </Modal>
  )
}
