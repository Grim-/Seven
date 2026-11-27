import { useEffect, useState, type CSSProperties } from 'react'
import type { Theme } from '@shared/theme'
import { lookFor } from '../../lib/skins/look'
import { noteFailure } from '../../store/problems'

export function useThemeLook(theme: Theme): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({})
  useEffect(() => {
    let live = true
    lookFor(theme)
      .then((look) => live && setStyle(look.vars as CSSProperties))
      .catch(noteFailure('themes', `Could not draw the ${theme.name} preview`))
    return () => {
      live = false
    }
  }, [theme])
  return style
}
