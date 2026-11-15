import { useMemo } from 'react'
import type { ModuleEntry, ModuleList } from '@shared/moduleList'
import { useTools } from '../store/tools'

export function useModuleList<T extends ModuleEntry>(list: ModuleList<T>): T[] | null {
  const loaded = useTools((s) => s.loaded)
  const modules = useTools((s) => s.list)
  return useMemo(() => {
    if (!loaded) return null
    const on = new Set(modules.filter((m) => m.state === 'on').map((m) => m.id))
    return list.on((module) => on.has(module))
  }, [list, loaded, modules])
}
