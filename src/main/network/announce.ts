import { noteMainFailure } from '../problems'
import os from 'node:os'
import Bonjour from 'bonjour-service'
import type { NetworkSettings } from '@shared/types'

export class Announcer {
  private instance: Bonjour | null = null

  constructor(
    private settings: () => NetworkSettings,
    private id: () => string
  ) {}

  announcing(): boolean {
    return this.instance !== null
  }

  start(): void {
    this.stop()
    const s = this.settings()
    if (!s.announce) return
    try {
      const instance = new Bonjour()
      instance.publish({ name: s.announceName || os.hostname(), type: s.announceType, port: s.port, txt: { id: this.id() } })
      this.instance = instance
    } catch (err) {
      noteMainFailure(err, 'network', 'Could not announce Seven on the local network, so devices must be given its address')
      this.instance = null
    }
  }

  stop(): void {
    const instance = this.instance
    this.instance = null
    if (!instance) return
    try {
      instance.unpublishAll(() => instance.destroy())
    } catch {
      return
    }
  }
}
