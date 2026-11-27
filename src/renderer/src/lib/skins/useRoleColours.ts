import { useMemo } from 'react'
import { useThemes } from '../../store/themes'
import { readRoles, type Roles } from './roles'

export function currentRoles(): Roles {
  return useThemes.getState().roles ?? readRoles()
}

export function useRoleColours(): Roles {
  const roles = useThemes((s) => s.roles)
  return useMemo(() => roles ?? readRoles(), [roles])
}
