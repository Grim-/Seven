import path from 'node:path'
import type { ServerBuild } from '@shared/types'
import { LLAMA_SERVER, LLAMA_SERVER_PROGRAM, llamaLimits, type ServerLimits } from '../../install/helpers/llamaServer'
import { activeVersion, lease } from '../../install/versions'
import { readCheck } from '../../install/store'

export { llamaLimits, type ServerLimits }

export function serverExe(): string | null {
  const v = activeVersion(LLAMA_SERVER)
  return v ? path.join(v.folder, LLAMA_SERVER_PROGRAM) : null
}

export function serverVersion(): string | null {
  return activeVersion(LLAMA_SERVER)?.id ?? null
}

export function serverBuild(): ServerBuild | null {
  const v = activeVersion(LLAMA_SERVER)
  if (!v) return null
  const check = readCheck(LLAMA_SERVER, v.id)
  return { version: v.id, label: v.label ?? v.id, flags: check?.ok && check.flags?.length ? check.flags : null }
}

export function serverDevices(): string | null {
  const v = activeVersion(LLAMA_SERVER)
  return v ? (readCheck(LLAMA_SERVER, v.id)?.devices ?? null) : null
}

export function serverLease(version: string, holder: string): () => void {
  return lease(LLAMA_SERVER, version, holder)
}
