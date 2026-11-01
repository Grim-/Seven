import { createContext, useContext } from 'react'

export const ViewZoom = createContext(1)

export const useViewZoom = (): number => useContext(ViewZoom)
