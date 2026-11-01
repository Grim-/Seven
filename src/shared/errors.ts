export const VAULT_LOCKED = 'VAULT_LOCKED'
export const WRONG_PASSPHRASE = 'WRONG_PASSPHRASE'
export const CHAT_BUSY = 'CHAT_BUSY'

export function errorCode(err: unknown): string | null {
  const code = typeof err === 'object' && err !== null ? (err as { code?: unknown }).code : undefined
  return typeof code === 'string' ? code : null
}
