import crypto from 'node:crypto'
import type { NetworkSettings, PairingRequest } from '@shared/types'

export type PairOutcome = 'allowed' | 'denied' | 'expired'

interface Pending extends PairingRequest {
  resolve: (outcome: PairOutcome) => void
}

export class Pairing {
  private code: { value: string; expiresAt: number; usesLeft: number } | null = null
  private pending: Pending | null = null
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private settings: () => NetworkSettings,
    private changed: () => void
  ) {}

  isOpen(): boolean {
    return this.code !== null && this.code.expiresAt > Date.now()
  }

  request(): PairingRequest | null {
    return this.pending ? { id: this.pending.id, name: this.pending.name, address: this.pending.address } : null
  }

  open(): { code: string; expiresAt: number } {
    this.close()
    const s = this.settings()
    const expiresAt = Date.now() + s.pairCodeSeconds * 1000
    this.code = { value: crypto.randomInt(0, 100000000).toString().padStart(8, '0'), expiresAt, usesLeft: s.pairCodeUses }
    this.timer = setTimeout(() => this.close(), s.pairCodeSeconds * 1000)
    this.changed()
    return { code: this.code.value, expiresAt }
  }

  close(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.code = null
    this.settle('expired')
    this.changed()
  }

  claim(code: string, name: string, address: string): Promise<PairOutcome> | null {
    if (!this.isOpen() || !this.code || this.pending || this.code.usesLeft < 1) return null
    const got = crypto.createHash('sha256').update(code).digest()
    const want = crypto.createHash('sha256').update(this.code.value).digest()
    if (!crypto.timingSafeEqual(got, want)) return null
    return new Promise((resolve) => {
      this.pending = { id: crypto.randomUUID(), name: name.trim().slice(0, 64) || 'Device', address, resolve }
      this.changed()
    })
  }

  allow(requestId: string): boolean {
    if (!this.pending || this.pending.id !== requestId) return false
    if (this.code) {
      this.code.usesLeft--
      if (this.code.usesLeft < 1) {
        if (this.timer) clearTimeout(this.timer)
        this.timer = null
        this.code = null
      }
    }
    this.settle('allowed')
    this.changed()
    return true
  }

  deny(requestId: string): boolean {
    if (!this.pending || this.pending.id !== requestId) return false
    this.settle('denied')
    this.changed()
    return true
  }

  private settle(outcome: PairOutcome): void {
    const pending = this.pending
    this.pending = null
    pending?.resolve(outcome)
  }
}
