import { useEffect, useRef } from 'react'
import type { Theme } from '@shared/theme'
import { useThemes } from '../../store/themes'
import { noteFailure } from '../../store/problems'
import { transitionViewDone } from '../viewTransition'
import { NO_LOOK, lookFor, writeLook, type Look } from './look'
import { rememberLook } from './rememberLook'
import { paletteOf } from './palette'
import { readRoles } from './roles'

export function useApplyLook(theme: Theme): void {
  const shown = useRef<string | null>(null)
  const latest = useRef(0)
  useEffect(() => {
    const run = ++latest.current
    const current = () => run === latest.current
    const switching = shown.current !== null && shown.current !== theme.id
    if (switching) useThemes.setState({ switching: true })
    const apply = (look: Look) => {
      if (!current()) return
      if (switching) writeLook(NO_LOOK)
      writeLook(look)
      const roles = readRoles()
      useThemes.setState({ active: theme, roles, palette: paletteOf(roles) })
      rememberLook(roles)
      shown.current = theme.id
    }
    lookFor(theme)
      .then((look) => (!current() ? undefined : switching ? transitionViewDone(() => apply(look)) : apply(look)))
      .catch(noteFailure('themes', `Could not apply ${theme.name}`))
      .finally(() => {
        if (current()) useThemes.setState({ switching: false })
      })
  }, [theme])
  useEffect(
    () => () => writeLook(NO_LOOK),
    []
  )
}
