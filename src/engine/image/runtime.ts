import type { ImageHost } from './host'
import type { ModelRegistry } from '../model/registry'

export interface ImageRuntime {
  host: ImageHost
  models: ModelRegistry
}

let current: ImageRuntime | null = null

export function setImageRuntime(runtime: ImageRuntime): void {
  current = runtime
}

export function getImageRuntime(): ImageRuntime | null {
  return current
}
