import { useEffect, type RefObject } from 'react'
import { drawCarryFrame, frameLayout, type FrameInfo } from './drawCarryFrame'
import { readFramePalette } from './framePalette'

export function FramePreview({ bitmap, info, framed, canvasRef }: { bitmap: ImageBitmap; info: FrameInfo; framed: boolean; canvasRef: RefObject<HTMLCanvasElement | null> }) {
  const key = JSON.stringify(info)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let live = true
    void document.fonts.ready.then(() => {
      const ctx = live ? canvas.getContext('2d') : null
      if (!ctx) return
      if (!framed) {
        canvas.width = bitmap.width
        canvas.height = bitmap.height
        ctx.drawImage(bitmap, 0, 0)
        return
      }
      const { width, height } = frameLayout(bitmap.width, bitmap.height)
      canvas.width = width
      canvas.height = height
      drawCarryFrame(ctx, bitmap, bitmap.width, bitmap.height, info, readFramePalette())
    })
    return () => {
      live = false
    }
  }, [bitmap, framed, key, canvasRef])
  return <canvas ref={canvasRef} className="block max-h-full max-w-full object-contain shadow-[0_0_40px_color-mix(in_srgb,var(--color-accent)_calc(14%*var(--glow)),transparent)]" />
}
