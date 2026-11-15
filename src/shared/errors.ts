export const VAULT_LOCKED = 'VAULT_LOCKED'
export const WRONG_PASSPHRASE = 'WRONG_PASSPHRASE'
export const CHAT_BUSY = 'CHAT_BUSY'
export const REMOTE_DENIED = 'REMOTE_DENIED'
export const NOT_FOUND = 'NOT_FOUND'
export const UNCODED = 'ERROR'

export class NotFoundError extends Error {
  readonly code = NOT_FOUND
}

export function errorCode(err: unknown): string | null {
  const code = typeof err === 'object' && err !== null ? (err as { code?: unknown }).code : undefined
  return typeof code === 'string' ? code : null
}

export function isNotFound(err: unknown): boolean {
  return errorCode(err) === NOT_FOUND
}

export function notFound<E extends Error>(err: E): E {
  return Object.assign(err, { code: NOT_FOUND })
}
