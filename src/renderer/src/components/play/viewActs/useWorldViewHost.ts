import { useEffect } from 'react'
import { useLatest } from '../../../game/react/useLatest'
import { setWorldViewHost, type WorldViewHost } from './registry'

export function useWorldViewHost(host: WorldViewHost): void {
  const latest = useLatest(host)
  useEffect(() => {
    setWorldViewHost(() => latest.current)
    return () => setWorldViewHost(null)
  }, [latest])
}
