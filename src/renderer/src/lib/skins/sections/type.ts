import { NUMERALS, TYPE_CASES, TYPE_ROLES, TYPE_VARIANTS, type Numerals, type LookType, type TypeCase, type TypeVariant } from '@shared/themeLook'
import { present, registerSkinSection, type SkinReader } from './registry'

function vars(role: string, t: LookType | undefined): Record<string, string | undefined> {
  return {
    [`--${role}-font`]: t?.font === undefined ? undefined : t.font === 'inherit' ? 'initial' : `var(--font-${t.font})`,
    [`--${role}-size`]: t?.size === undefined ? undefined : `${t.size}px`,
    [`--${role}-weight`]: t?.weight === undefined ? undefined : String(t.weight),
    [`--${role}-case`]: t?.case,
    [`--${role}-tracking`]: t?.tracking === undefined ? undefined : `${t.tracking}em`,
    [`--${role}-variant`]: t?.variant
  }
}

function readRole(read: SkinReader, role: string): LookType {
  const kase = read.value(`--${role}-case`)
  const variant = read.value(`--${role}-variant`)
  return {
    size: read.number(`--${role}-size`),
    weight: read.number(`--${role}-weight`),
    case: TYPE_CASES.includes(kase as TypeCase) ? (kase as TypeCase) : undefined,
    tracking: read.number(`--${role}-tracking`),
    variant: TYPE_VARIANTS.includes(variant as TypeVariant) ? (variant as TypeVariant) : undefined
  }
}

registerSkinSection({
  vars: (theme) => present({ ...Object.assign({}, ...TYPE_ROLES.map((r) => vars(r, theme.type[r]))), '--data-variant': theme.numerals ?? undefined }),
  read: (read) => {
    const numerals = read.value('--data-variant')
    return { type: Object.fromEntries(TYPE_ROLES.map((r) => [r, readRole(read, r)])), numerals: NUMERALS.includes(numerals as Numerals) ? (numerals as Numerals) : null }
  }
})
