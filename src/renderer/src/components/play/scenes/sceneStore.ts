import { create } from 'zustand'
import type { PlayScene } from './PlayScene'
import { exploreScene } from './exploreScene'

interface PlaySceneStore {
  scene: PlayScene
  startBattle: () => void
  endBattle: () => void
}

export const usePlayScene = create<PlaySceneStore>((set) => ({
  scene: exploreScene,
  startBattle: () =>
    set((s) => {
      const next = s.scene.startBattle?.() ?? s.scene
      return next === s.scene ? s : { scene: next }
    }),
  endBattle: () =>
    set((s) => {
      const next = s.scene.endBattle?.() ?? s.scene
      return next === s.scene ? s : { scene: next }
    })
}))
