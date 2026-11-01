import { createContext, useContext } from 'react'
import type { AssetMeta } from '@shared/types'

export const ChatPictures = createContext<{ height: number } | null>(null)

export function useChatPictures(): { height: number } | null {
  return useContext(ChatPictures)
}

export function assetByRef(assets: AssetMeta[], ref: string): AssetMeta | undefined {
  const r = ref.trim().toLowerCase()
  return assets.find((a) => a.id === r || a.name.toLowerCase() === r)
}
