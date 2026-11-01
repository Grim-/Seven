import type { SystemStats } from '@shared/types'
import type { Tone } from '../ui'
import { gigabytes } from '../../lib/systemStats'

export interface MemoryFit {
  tone: Tone
  label: string
  hint: string
}

export function memoryFit(size: number, stats: SystemStats | null): MemoryFit | null {
  if (!stats) return null
  const ramFree = Math.max(0, stats.ramTotal - stats.ramUsed)
  if (stats.vramTotal === null) {
    return size <= ramFree
      ? { tone: 'warn', label: 'Fits RAM', hint: `Smaller than your free RAM (${gigabytes(ramFree)} GB). Free VRAM shows once a model has been loaded. Its context needs room too.` }
      : { tone: 'error', label: 'Too big', hint: `Bigger than your free RAM (${gigabytes(ramFree)} GB). Free VRAM shows once a model has been loaded.` }
  }
  const vramFree = Math.max(0, stats.vramTotal - (stats.vramUsed ?? 0))
  if (size <= vramFree) return { tone: 'ok', label: 'Fits VRAM', hint: `Smaller than your free VRAM (${gigabytes(vramFree)} GB). Its context needs room too.` }
  if (size <= vramFree + ramFree) return { tone: 'warn', label: 'VRAM + RAM', hint: `Bigger than your free VRAM (${gigabytes(vramFree)} GB), but fits in free VRAM and RAM together (${gigabytes(vramFree + ramFree)} GB). Slower than VRAM alone.` }
  return { tone: 'error', label: 'Too big', hint: `Bigger than your free VRAM and RAM together (${gigabytes(vramFree + ramFree)} GB).` }
}
