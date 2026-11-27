import { useEffect, useRef, useState } from 'react'
import { GameEngine } from '../engine/GameEngine'
import type { View } from '../engine/Camera'
import { readImage } from '../../lib/assetSource'
import { useViewPlace } from '../../lib/viewPlace'
import { ZoomControls } from '../../components/space/ZoomControls'
import { cn } from '../../lib/cn'
import { useRoleColours } from '../../lib/skins/useRoleColours'

const ZOOM_STEP = 1.25

export function GameCanvas({ place, onReady, className }: { place: string; onReady: (engine: GameEngine, view: View | null) => () => void; className?: string }) {
  const host = useRef<HTMLDivElement>(null)
  const [engine, setEngine] = useState<GameEngine | null>(null)
  const [saved, save] = useViewPlace<View | null>(`game.${place}`, null)
  const savedRef = useRef(saved)
  savedRef.current = saved
  const readyRef = useRef(onReady)
  readyRef.current = onReady
  const roles = useRoleColours()

  useEffect(() => {
    const el = host.current
    if (!el) return
    let made: GameEngine | null = null
    let live = true
    void GameEngine.create(el, readImage).then((e) => {
      if (!live) return e.destroy()
      made = e
      setEngine(e)
    })
    return () => {
      live = false
      made?.destroy()
      setEngine(null)
    }
  }, [roles])

  useEffect(() => {
    if (!engine) return
    engine.camera.onSettle = save
    return readyRef.current(engine, savedRef.current)
  }, [engine])

  const middle = () => ({ x: engine!.app.screen.width / 2, y: engine!.app.screen.height / 2 })
  return (
    <div className={cn('relative overflow-hidden', className)}>
      <div ref={host} className="absolute inset-0" />
      {engine && <ZoomControls onIn={() => engine.camera.zoomAt(ZOOM_STEP, middle())} onOut={() => engine.camera.zoomAt(1 / ZOOM_STEP, middle())} onFit={() => engine.camera.fit()} />}
    </div>
  )
}
