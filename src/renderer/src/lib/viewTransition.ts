import { flushSync } from 'react-dom'

let currentTransitionId: string | null = null

export function getTransitionId(): string | null {
  return currentTransitionId
}

export function setTransitionId(id: string | null): void {
  currentTransitionId = id
}

export function transitionViewDone(update: () => void): Promise<void> {
  if (typeof document === 'undefined' || !('startViewTransition' in document)) {
    update()
    return Promise.resolve()
  }
  return document.startViewTransition(() => {
    flushSync(update)
  }).finished
}

export function transitionView(update: () => void, targetId?: string | null): void {
  if (targetId !== undefined) {
    currentTransitionId = targetId
  }
  if (typeof document === 'undefined' || !('startViewTransition' in document)) {
    update()
    return
  }
  try {
    document.startViewTransition(() => {
      flushSync(() => {
        update()
      })
    })
  } catch {
    update()
  }
}
