import type { PermissionMode, ReminderRepeat } from './types'

export type RoutineWhen =
  | { type: 'schedule'; at: number; repeat: ReminderRepeat }
  | { type: 'event'; kind: string; entry: string | null; action: 'any' | 'made' | 'changed'; byUser: boolean }

export interface RoutineOutput {
  chat: 'new' | 'same'
  page: string | null
  notify: boolean
}

export interface Routine {
  id: string
  name: string
  agentId: string
  instruction: string
  when: RoutineWhen
  output: RoutineOutput
  permissionMode: PermissionMode | null
  enabled: boolean
  next: number | null
  lastRun: number | null
  lastChat: string | null
  lastError: string | null
  running: boolean
  createdAt: number
  updatedAt: number
}

export interface RoutineDraft {
  id: string | null
  name: string
  agentId: string
  instruction: string
  when: RoutineWhen
  output: RoutineOutput
  permissionMode: PermissionMode | null
  enabled: boolean
  entryLink?: string | null
}

export const ROUTINE_REPEATS: { id: ReminderRepeat; label: string }[] = [
  { id: 'none', label: 'Once' },
  { id: 'hourly', label: 'Every hour' },
  { id: 'daily', label: 'Every day' },
  { id: 'weekdays', label: 'Weekdays' },
  { id: 'weekly', label: 'Every week' }
]
