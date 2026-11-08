type Handler<T> = (value: T) => void

export class EventBus<Events extends object> {
  private handlers = new Map<keyof Events, Set<Handler<never>>>()

  on<K extends keyof Events>(name: K, fn: Handler<Events[K]>): () => void {
    let set = this.handlers.get(name)
    if (!set) {
      set = new Set()
      this.handlers.set(name, set)
    }
    set.add(fn as Handler<never>)
    return () => set.delete(fn as Handler<never>)
  }

  emit<K extends keyof Events>(name: K, value: Events[K]): void {
    for (const fn of this.handlers.get(name) ?? []) (fn as Handler<Events[K]>)(value)
  }

  clear(): void {
    this.handlers.clear()
  }
}
