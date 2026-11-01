import { useEffect, useState } from 'react'
import type { WorkoutHistory } from '@shared/types'
import { engine, on } from '../../../lib/ipc'
import { errorText } from '../../../lib/format'

export function useWorkoutHistory(): { history: WorkoutHistory | null; error: string | null } {
  const [history, setHistory] = useState<WorkoutHistory | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    const load = () =>
      void engine('workout.history')
        .then((h) => live && (setHistory(h), setError(null)))
        .catch((err) => live && setError(errorText(err)))
    load()
    const off = on('workout.changed', load)
    return () => {
      live = false
      off()
    }
  }, [])
  return { history, error }
}
