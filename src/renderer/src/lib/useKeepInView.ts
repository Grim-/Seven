import { useEffect, useRef } from 'react'

export function useKeepInView<T extends HTMLElement>(index: number) {
  const ref = useRef<T>(null)
  useEffect(() => {
    ref.current?.children[index]?.scrollIntoView({ block: 'nearest' })
  }, [index])
  return ref
}
