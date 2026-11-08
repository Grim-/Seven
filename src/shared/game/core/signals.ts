export type SignalHandler = (payload: Record<string, unknown>) => void

export class SignalBus {
  private handlers = new Map<string, Set<SignalHandler>>()

  on(signal: string, fn: SignalHandler): () => void {
    let set = this.handlers.get(signal)
    if (!set) {
      set = new Set()
      this.handlers.set(signal, set)
    }
    set.add(fn)
    return () => set.delete(fn)
  }

  emit(signal: string, payload: Record<string, unknown> = {}): void {
    for (const fn of [...(this.handlers.get(signal) ?? [])]) fn(payload)
  }

  clear(): void {
    this.handlers.clear()
  }
}
