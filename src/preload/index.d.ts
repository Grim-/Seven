import type { SevenApi } from '../shared/protocol'

declare global {
  interface Window {
    seven: SevenApi
  }
}
