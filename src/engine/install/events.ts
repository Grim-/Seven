import { EventEmitter } from 'node:events'
import type { InstallProgress } from '@shared/types'

class InstallEvents extends EventEmitter {
  changed(helper: string): void {
    this.emit('changed', helper)
    this.emit(`changed:${helper}`)
  }

  onHelper(helper: string, fn: () => void): void {
    this.on(`changed:${helper}`, fn)
  }

  progress(p: InstallProgress): void {
    this.emit('progress', p)
  }
}

export const installEvents = new InstallEvents()
