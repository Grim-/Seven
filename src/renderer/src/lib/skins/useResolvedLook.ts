import { useEffect, useState } from 'react'
import type { Theme, ThemeInput } from '@shared/theme'
import { resolvedLook } from './resolvedLook'
import { noteFailure } from '../../store/problems'

const cache = new Map<string, Promise<ThemeInput>>()

export function useResolvedLook(theme: Theme): ThemeInput {
  const key = `${theme.id}:${theme.updatedAt}`
  const [values, setValues] = useState<ThemeInput>({})
  useEffect(() => {
    let live = true
    if (!cache.has(key)) cache.set(key, resolvedLook(theme))
    cache
      .get(key)!
      .then((v) => live && setValues(v))
      .catch(noteFailure('themes', 'Could not read the theme\'s values'))
    return () => {
      live = false
    }
  }, [key])
  return values
}
