import { AsyncLocalStorage } from 'node:async_hooks'

export interface Actor {
  agentId: string | null
  sessionId: string | null
}

const store = new AsyncLocalStorage<Actor>()

export function asActor<T>(actor: Actor, fn: () => T): T {
  return store.run(actor, fn)
}

export function currentActor(): Actor {
  return store.getStore() ?? { agentId: null, sessionId: null }
}
