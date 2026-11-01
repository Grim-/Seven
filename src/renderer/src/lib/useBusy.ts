import { useRef, useState } from 'react'
import { failed } from './notify'

export type Run = <T>(work: () => Promise<T>, onError?: string | ((err: unknown) => void)) => Promise<T | undefined>

export function useBusy(): [boolean, Run] {
  const [busy, setBusy] = useState(false)
  const live = useRef(0)
  const run: Run = async (work, onError) => {
    live.current += 1
    setBusy(true)
    try {
      return await work()
    } catch (err) {
      if (typeof onError === 'function') onError(err)
      else failed(onError ?? 'Something went wrong')(err)
      return undefined
    } finally {
      live.current -= 1
      if (!live.current) setBusy(false)
    }
  }
  return [busy, run]
}
