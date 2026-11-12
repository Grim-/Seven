import type { SevenApi } from '@shared/protocol'
import { registerTransport } from '../lib/transport'

registerTransport(() => {
  if (!('seven' in window)) return null
  const { engine, main, on, pathForFile } = window.seven as SevenApi
  return { engine, main, on, capabilities: { pathForFile }, allows: () => true }
})
