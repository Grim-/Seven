import { useEffect, useState } from 'react'
import type { NetworkStatus, ServerStatus } from '@shared/types'
import { engine, main, on } from '../../lib/ipc'
import { noteFailure } from '../../store/problems'

export function useServerStatus(everyMs: number): { status: ServerStatus | null; network: NetworkStatus | null; reload: () => void } {
  const [status, setStatus] = useState<ServerStatus | null>(null)
  const [network, setNetwork] = useState<NetworkStatus | null>(null)
  const reload = () => {
    void engine('server.status')
      .then(setStatus)
      .catch(noteFailure('server', 'Could not read the server status'))
    void main('network.status')
      .then(setNetwork)
      .catch(noteFailure('network', 'Could not read the network status'))
  }
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
  return { status, network, reload }
}
