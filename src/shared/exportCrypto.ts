import crypto from 'node:crypto'

const MAGIC = Buffer.from('S7PW')
const VERSION = 1
const SALT_LEN = 16
const IV_LEN = 12
const TAG_LEN = 16
const HEADER_LEN = MAGIC.length + 1 + SALT_LEN + IV_LEN + TAG_LEN
const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1
const SCRYPT_MAXMEM = 64 * 1024 * 1024

export class WrongPasswordError extends Error {
  constructor(message = 'Incorrect export password. Check the password and try again.') {
    super(message)
    this.name = 'WrongPasswordError'
  }
}

export class WrongVaultKeyError extends Error {
  constructor(message = 'This export is locked to a different vault key and cannot be decrypted here.') {
    super(message)
    this.name = 'WrongVaultKeyError'
  }
}

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  if (!passphrase) throw new Error('Enter a password to lock or unlock this export.')
  return crypto.scryptSync(passphrase.normalize('NFKC'), salt, 32, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM
  })
}

export function isPasswordSealed(buf: Buffer): boolean {
  return buf.length >= HEADER_LEN && buf.subarray(0, MAGIC.length).equals(MAGIC)
}

export function sealWithPassword(plain: Buffer, passphrase: string): Buffer {
  const salt = crypto.randomBytes(SALT_LEN)
  const iv = crypto.randomBytes(IV_LEN)
  const key = deriveKey(passphrase, salt)
  try {
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
    const encrypted = Buffer.concat([cipher.update(plain), cipher.final()])
    const tag = cipher.getAuthTag()
    return Buffer.concat([MAGIC, Buffer.from([VERSION]), salt, iv, tag, encrypted])
  } finally {
    key.fill(0)
  }
}

export function unsealWithPassword(blob: Buffer, passphrase: string): Buffer {
  if (!isPasswordSealed(blob)) throw new Error('This file is not password-protected.')
  const version = blob[MAGIC.length]
  if (version !== VERSION) throw new Error('This encrypted export uses a newer format. Update Seven to open it.')
  let at = MAGIC.length + 1
  const salt = blob.subarray(at, at + SALT_LEN)
  at += SALT_LEN
  const iv = blob.subarray(at, at + IV_LEN)
  at += IV_LEN
  const tag = blob.subarray(at, at + TAG_LEN)
  at += TAG_LEN
  const ciphertext = blob.subarray(at)
  const key = deriveKey(passphrase, salt)
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()])
  } catch {
    throw new WrongPasswordError()
  } finally {
    key.fill(0)
  }
}
