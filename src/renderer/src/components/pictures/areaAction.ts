import { createContext, useContext } from 'react'
import type { PictureArea } from '@shared/types'

export const AreaAction = createContext<((area: PictureArea) => void) | null>(null)

export function useAreaAction(): ((area: PictureArea) => void) | null {
  return useContext(AreaAction)
}

export function namedAreas(areas: PictureArea[] | undefined): PictureArea[] {
  return (areas ?? []).filter((a) => a.name)
}
