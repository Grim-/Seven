import { globalShortcut } from 'electron'

export class Hotkey {
  private current: string | null = null

  constructor(private onTrigger: () => void) {}

  apply(accelerator: string): string | null {
    const next = accelerator.trim()
    if (this.current) globalShortcut.unregister(this.current)
    this.current = null
    if (!next) return null
    try {
      const ok = globalShortcut.register(next, this.onTrigger)
      if (!ok) return `"${next}" is already used by another program`
      this.current = next
      return null
    } catch {
      return `"${next}" is not a valid shortcut`
    }
  }

  dispose(): void {
    globalShortcut.unregisterAll()
    this.current = null
  }
}
