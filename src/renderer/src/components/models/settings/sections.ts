import type { ParamSection } from '@shared/types'

export interface ModelSection {
  id: ParamSection
  label: string
  group: string
}

export const MODEL_SECTIONS: ModelSection[] = [
  { id: 'memory', label: 'Memory and GPU', group: 'Load' },
  { id: 'context', label: 'Context', group: 'Load' },
  { id: 'speed', label: 'Speed', group: 'Load' },
  { id: 'vision', label: 'Vision', group: 'Load' },
  { id: 'files', label: 'Add-on files', group: 'Load' },
  { id: 'thinking', label: 'Thinking', group: 'Replies' },
  { id: 'sampling', label: 'Sampling', group: 'Replies' },
  { id: 'repetition', label: 'Repetition', group: 'Replies' },
  { id: 'advanced', label: 'Advanced', group: 'Replies' }
]

export const REMOTE_KEYS = new Set(['contextSize', 'temperature', 'topP', 'maxTokens', 'thinking', 'thinkingLow', 'thinkingMedium', 'thinkingHigh'])
