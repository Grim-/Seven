import { useState } from 'react'
import type { MapToken } from '../../maps/TokenLayer'
import { useDialogue, type ActiveSpeechBubble } from '../dialogue/dialogueStore'
import type { View } from '../../../game/engine/Camera'

interface SpeechBubbleOverlayProps {
  tokens: MapToken[]
  camera: View | null
  tileSize?: number
}

function BubbleItem({
  bubble,
  screenX,
  screenY
}: {
  bubble: ActiveSpeechBubble
  screenX: number
  screenY: number
}) {
  const [wide, setWide] = useState(bubble.wide ?? false)
  const dismiss = useDialogue((s) => s.dismissBubble)

  return (
    <div
      style={{
        left: `${screenX}px`,
        top: `${screenY - 24}px`,
        transform: 'translate(-50%, -100%)'
      }}
      className={`pointer-events-auto absolute z-40 flex flex-col border-2 border-accent bg-black/95 p-2.5 font-mono text-[12px] shadow-[0_8px_32px_rgba(0,0,0,0.9)] backdrop-blur transition-all duration-150 ${
        wide ? 'max-h-[360px] w-[min(540px,90vw)]' : 'max-h-[220px] w-[min(340px,80vw)]'
      }`}
    >
      {/* COMIC TAIL ARROW */}
      <div
        className="pointer-events-none absolute -bottom-[8px] left-1/2 -translate-x-1/2 border-l-[8px] border-r-[8px] border-t-[8px] border-l-transparent border-r-transparent border-t-accent"
      />

      {/* HEADER */}
      <div className="flex items-center justify-between border-b border-line pb-1 text-[9px] font-bold uppercase tracking-wider text-faint">
        <span className="text-accent">{bubble.speakerName}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWide(!wide)}
            className="text-cyan hover:underline"
          >
            [{wide ? 'COMPACT' : 'WIDE'}]
          </button>
          <button
            type="button"
            onClick={() => dismiss(bubble.sheet)}
            className="text-faint hover:text-white"
          >
            ✕
          </button>
        </div>
      </div>

      {/* BODY CONTENT - FLUID AUTO-EXPANDING */}
      <div className="mt-1.5 overflow-y-auto leading-relaxed text-white">
        {bubble.text}
      </div>
    </div>
  )
}

export function SpeechBubbleOverlay({ tokens, camera }: SpeechBubbleOverlayProps) {
  const bubbles = useDialogue((s) => s.bubbles)
  const activeEntries = Object.values(bubbles)

  if (!camera || activeEntries.length === 0) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {activeEntries.map((bubble) => {
        const token = tokens.find((t) => t.visitor.sheet === bubble.sheet)
        if (!token) return null

        const screenX = Math.round(token.at.x * camera.zoom + camera.x)
        const screenY = Math.round(token.at.y * camera.zoom + camera.y)

        return (
          <BubbleItem
            key={bubble.id}
            bubble={bubble}
            screenX={screenX}
            screenY={screenY}
          />
        )
      })}
    </div>
  )
}
