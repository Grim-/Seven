import { useEffect, useState } from 'react'
import type { InstallHelperState, InstallProgress } from '@shared/types'
import { engine, on } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'

export function useInstallHelper(id: string): { state: InstallHelperState | null; progress: InstallProgress | null } {
  const state = useLive(() => engine('install.state', { helper: id }), 'install.changed', [id])
  const [progress, setProgress] = useState<InstallProgress | null>(null)
  useEffect(() => on('install.progress', (p) => p.helper === id && setProgress(p)), [id])
  return { state, progress: progress ?? state?.job ?? null }
}
