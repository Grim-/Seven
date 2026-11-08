import { useEffect, useState } from 'react'
import type { ProjectorChoice } from '@shared/types'
import { engine } from '../../lib/ipc'
import { failed } from '../../lib/notify'

export function useProjector(id: string): { state: ProjectorChoice | null; pick: (projector: string | null) => void } {
  const [state, setState] = useState<ProjectorChoice | null>(null)
  useEffect(() => {
    void engine('models.projector.get', { id })
      .then(setState)
      .catch(() => undefined)
  }, [id])
  const pick = (projector: string | null) =>
    void engine('models.projector.set', { id, projector })
      .then(setState)
      .catch(failed('Could not set the vision adapter'))
  return { state, pick }
}
