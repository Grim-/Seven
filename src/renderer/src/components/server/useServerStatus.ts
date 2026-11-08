import { useEffect, useState } from 'react'
import type { ServerStatus } from '@shared/types'
import { engine, on } from '../../lib/ipc'

export function useServerStatus(everyMs: number): { status: ServerStatus | null; reload: () => void } {
  const [status, setStatus] = useState<ServerStatus | null>(null)
  const reload = () =>
    void engine('server.status')
      .then(setStatus)
      .catch(() => undefined)
  useEffect(() => {
    reload()
    const timer = setInterval(reload, everyMs)
    const offNetwork = on('network.changed', reload)
    const offModel = on('model.state', reload)
    return () => {
      clearInterval(timer)
      offNetwork()
      offModel()
    }
  }, [everyMs])
  return { status, reload }
}
