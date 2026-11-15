import type { ComponentType } from 'react'
import type { ParamKind, ParamSpec } from '@shared/game/core/params'

export interface TokenProps {
  spec: ParamSpec
  value: unknown
}

export interface TokenEditProps extends TokenProps {
  onChange: (value: unknown) => void
  close: () => void
}

export interface EffectToken {
  Text: ComponentType<TokenProps>
  Edit: ComponentType<TokenEditProps>
  tone?: string
  wide?: boolean
}

const tokens = new Map<ParamKind, EffectToken>()

export function registerEffectToken(kind: ParamKind, token: EffectToken): void {
  tokens.set(kind, token)
}

export function effectToken(kind: ParamKind): EffectToken | null {
  return tokens.get(kind) ?? null
}
