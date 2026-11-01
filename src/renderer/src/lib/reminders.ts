import { useEffect, useState } from 'react'
import type { Reminder } from '@shared/types'
import { engine, on } from './ipc'
import { errorText } from './format'

export function useReminderList(): { list: Reminder[] | null; error: string | null } {
  const [list, setList] = useState<Reminder[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    engine('reminders.list')
      .then(setList)
      .catch((err) => setError(errorText(err)))
    return on('reminders.changed', setList)
  }, [])
  return { list, error }
}
