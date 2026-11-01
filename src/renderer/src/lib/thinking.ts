import type { ThinkingLevel } from '@shared/types'

export function thinkingLabel(level: ThinkingLevel): string {
  return level[0].toUpperCase() + level.slice(1)
}
