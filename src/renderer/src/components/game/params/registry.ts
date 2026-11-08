import type { ComponentType } from 'react'
import type { ParamKind, ParamSpec } from '@shared/game/core/params'

export interface ParamEditorProps {
  spec: ParamSpec
  value: unknown
  onChange: (value: unknown) => void
}

export interface ParamEditor {
  Editor: ComponentType<ParamEditorProps>
  wide?: boolean | ((spec: ParamSpec) => boolean)
}

const editors = new Map<ParamKind, ParamEditor>()

export function registerParamEditor(kind: ParamKind, editor: ParamEditor): void {
  editors.set(kind, editor)
}

export function paramEditor(kind: ParamKind): ParamEditor | null {
  return editors.get(kind) ?? null
}

export function paramWide(editor: ParamEditor | null, spec: ParamSpec): boolean {
  const wide = editor?.wide
  return typeof wide === 'function' ? wide(spec) : wide === true
}
