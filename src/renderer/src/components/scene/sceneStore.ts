import type { Drawn } from '../draw/DrawPanel'
import { useViewPlace } from '../../lib/viewPlace'

export interface SavedScene {
  agentId: string | null
  parts: Drawn[]
  line: string
  at: number
}

const same = (a: SavedScene, b: SavedScene) => a.agentId === b.agentId && a.line === b.line && JSON.stringify(a.parts) === JSON.stringify(b.parts)

export function sceneMessage(scene: Pick<SavedScene, 'parts' | 'line'>): string {
  return [scene.line.trim(), ...scene.parts.map((p) => p.value.trim())].filter(Boolean).join('\n\n')
}

export function useRecentScenes(): [SavedScene[], (scene: SavedScene) => void, (scene: SavedScene) => void] {
  const [list, setList] = useViewPlace<SavedScene[]>('scenes.recent', [])
  const remember = (scene: SavedScene) => setList([scene, ...list.filter((s) => !same(s, scene))])
  const forget = (scene: SavedScene) => setList(list.filter((s) => !same(s, scene)))
  return [list, remember, forget]
}
