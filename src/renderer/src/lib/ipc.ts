import type {
  EngineParams,
  EngineRequestName,
  EngineResult,
  EventName,
  Events,
  MainParams,
  MainRequestName,
  MainResult
} from '@shared/protocol'
import { ERROR_MARKER, type CodedErrorWire } from '@shared/protocol'
import { VAULT_LOCKED, errorCode } from '@shared/errors'
import { transport } from './transport'

export function isVaultLockedError(err: unknown): boolean {
  return errorCode(err) === VAULT_LOCKED
}

class CodedError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly request?: string
  ) {
    super(message)
  }
}

export function requestOf(err: unknown): string | undefined {
  return err instanceof CodedError ? err.request : undefined
}

function unwrap<T>(result: T): T {
  if (result && typeof result === 'object' && ERROR_MARKER in result) {
    const { code, message, request } = (result as unknown as CodedErrorWire)[ERROR_MARKER]
    throw new CodedError(code, message, request)
  }
  return result
}

function clean(err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err)
  return new Error(message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
}

export async function engine<K extends EngineRequestName>(name: K, ...args: EngineParams<K> extends void ? [] : [EngineParams<K>]): Promise<EngineResult<K>> {
  try {
    return unwrap(await transport().engine(name, args[0] as EngineParams<K>))
  } catch (err) {
    throw err instanceof CodedError ? err : clean(err)
  }
}

export async function main<K extends MainRequestName>(name: K, ...args: MainParams<K> extends void ? [] : [MainParams<K>]): Promise<MainResult<K>> {
  try {
    return unwrap(await transport().main(name, args[0] as MainParams<K>))
  } catch (err) {
    throw err instanceof CodedError ? err : clean(err)
  }
}

export function on<K extends EventName>(event: K, callback: (payload: Events[K]) => void): () => void {
  return transport().on(event, callback)
}
