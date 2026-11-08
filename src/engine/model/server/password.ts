import crypto from 'node:crypto'

export const PASSWORD_MIN = 16

export interface PasswordHash {
  salt: string
  hash: string
}

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, key) => (err ? reject(err) : resolve(key))))
}

export function suggestPassword(): string {
  return crypto.randomBytes(24).toString('base64url')
}

export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`
  if (new Set(password).size < 8) return 'Use more different characters.'
  return null
}

export async function hashPassword(password: string): Promise<PasswordHash> {
  const salt = crypto.randomBytes(16)
  return { salt: salt.toString('base64'), hash: (await derive(password, salt)).toString('base64') }
}

export async function passwordMatches(password: string, stored: PasswordHash): Promise<boolean> {
  const want = Buffer.from(stored.hash, 'base64')
  const got = await derive(password, Buffer.from(stored.salt, 'base64'))
  return got.length === want.length && crypto.timingSafeEqual(got, want)
}
