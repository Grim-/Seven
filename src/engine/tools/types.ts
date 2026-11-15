import type { PanelAccess } from '../panel/store'
import type { JsonObjectSchema } from './schema'
import type { AvatarState, ConfirmProps, FormProps, GatherProps, QuestionProps, ToolPermission, ViewRef, LinkedFolder } from '@shared/types'
import type { PermissionContext } from '../permissions/gate'
import type { PickDecisionProps } from '@shared/pickDecision'
import type { RolledDecisionProps } from '@shared/rolledDecision'
import type { OpposedProps } from '@shared/opposedCheck'
import type { ChatElement } from '@shared/chatElements'
import type { ViewEvent } from '@shared/effects'

export interface UiAccess {
  ask(kind: 'question', props: QuestionProps): Promise<unknown>
  ask(kind: 'confirm', props: ConfirmProps): Promise<unknown>
  ask(kind: 'form', props: FormProps): Promise<unknown>
  ask(kind: 'gather', props: GatherProps): Promise<unknown>
  ask(kind: 'decide', props: PickDecisionProps): Promise<unknown>
  ask(kind: 'rolled', props: RolledDecisionProps): Promise<unknown>
  ask(kind: 'opposed', props: OpposedProps): Promise<unknown>
  notify(title: string, message: string): void
}

export interface CheckpointWriter {
  save(absPath: string, previous: Buffer | null): void
}

export interface ToolContext {
  sessionId: string
  workspace: string | null
  folders: LinkedFolder[]
  groups: string[]
  signal: AbortSignal
  ui: UiAccess
  permissions: PermissionContext
  checkpoints: CheckpointWriter
  output: (chunk: string) => void
  budget: { maxTokens: number; count: (text: string) => number; dir: string; room?: () => number | null } | null
  agentId: string | null
  react: (state: AvatarState | null, reaction: string | null, seconds: number) => void
  addElement?: (element: ChatElement) => void
  viewEvents?: (events: ViewEvent[], title: string, world: string | null) => void
  panel: PanelAccess
}

export interface ToolScope {
  agentId: string | null
  files: boolean
}

export interface ToolOutput {
  text: string
  view?: ViewRef
  empty?: boolean
  images?: string[]
}

export interface ToolDef {
  name: string
  group: string
  description: string
  params: JsonObjectSchema
  needsWorkspace: boolean
  maxRepeats?: number
  activity?: (params: Record<string, unknown>) => string
  always?: boolean
  fitsItself?: boolean
  forAgent?: (scope: ToolScope) => Pick<ToolDef, 'params'>
  command?: boolean
  permission?: ToolPermission
  execute(params: Record<string, unknown>, ctx: ToolContext): Promise<string | ToolOutput>
}

export class ToolError extends Error {}

export class ToolBlocked extends ToolError {
  constructor(
    message: string,
    readonly reason: string
  ) {
    super(message)
  }
}

export function str(params: Record<string, unknown>, key: string): string {
  const value = params[key]
  if (typeof value !== 'string' || !value.trim()) throw new ToolError(`${key} is missing or empty. Set ${key} to some text.`)
  return value
}

export function optStr(params: Record<string, unknown>, key: string): string | null {
  const value = params[key]
  return typeof value === 'string' && value.trim() ? value : null
}

export function optInt(params: Record<string, unknown>, key: string): number | null {
  const value = params[key]
  return typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : null
}

export function optBool(params: Record<string, unknown>, key: string): boolean | null {
  const value = params[key]
  return typeof value === 'boolean' ? value : null
}
