import { registerVfxPreset } from './registry'

function sampleCurve(steps: number, fn: (p: number) => Keyframe): Keyframe[] {
  const out: Keyframe[] = []
  for (let i = 0; i <= steps; i++) out.push(fn(i / steps))
  return out
}

const glowShadow = (color: string, px: number, pct: number) => `0 0 ${px.toFixed(1)}px color-mix(in srgb, ${color} ${Math.round(pct)}%, transparent)`

registerVfxPreset({
  id: 'hit',
  label: 'Hit',
  tone: 'alert',
  defaultDurationMs: 460,
  build: ({ color, intensity, durationMs, reducedMotion }) => ({
    keyframes: sampleCurve(10, (p) => {
      const decay = 1 - p
      const env = Math.sin(p * Math.PI)
      const shift = reducedMotion ? 0 : Math.sin(p * Math.PI * 5) * decay * 6 * intensity
      const rot = reducedMotion ? 0 : Math.sin(p * Math.PI * 5) * decay * 2.5 * intensity
      return {
        transform: `translateX(${shift.toFixed(2)}px) rotate(${rot.toFixed(2)}deg)`,
        borderColor: p < 0.7 ? color : '',
        boxShadow: env > 0.05 ? `${glowShadow(color, 18 * env * intensity, 75 * decay)}, inset ${glowShadow(color, 14 * env * intensity, 45 * decay)}` : 'none'
      }
    }),
    options: { duration: durationMs, easing: 'linear' }
  })
})

registerVfxPreset({
  id: 'pulse',
  label: 'Pulse',
  tone: 'cyan',
  defaultDurationMs: 1100,
  build: ({ color, intensity, durationMs, reducedMotion, loop }) => ({
    keyframes: sampleCurve(8, (p) => {
      const wave = (1 - Math.cos(p * Math.PI * 2)) / 2
      const scale = reducedMotion ? 1 : 1 + wave * 0.03 * intensity
      return {
        transform: `scale(${scale.toFixed(4)})`,
        borderColor: wave > 0.15 ? color : '',
        boxShadow: wave > 0.05 ? glowShadow(color, 16 * wave * intensity, 70 * wave) : 'none'
      }
    }),
    options: { duration: durationMs, easing: 'linear', iterations: loop ? Infinity : 1 }
  })
})

registerVfxPreset({
  id: 'glow',
  label: 'Glow',
  tone: 'accent',
  defaultDurationMs: 1400,
  build: ({ color, intensity, durationMs, loop }) => ({
    keyframes: sampleCurve(6, (p) => {
      const wave = Math.sin(p * Math.PI)
      return {
        borderColor: wave > 0.1 ? color : '',
        boxShadow: wave > 0.05 ? glowShadow(color, 20 * wave * intensity, 80 * wave) : 'none'
      }
    }),
    options: { duration: durationMs, easing: 'ease-in-out', iterations: loop ? Infinity : 1 }
  })
})

registerVfxPreset({
  id: 'wobble',
  label: 'Wobble',
  tone: 'accent',
  defaultDurationMs: 560,
  build: ({ color, intensity, durationMs, reducedMotion }) => ({
    keyframes: sampleCurve(10, (p) => {
      const decay = 1 - p
      const deg = reducedMotion ? 0 : Math.sin(p * Math.PI * 4) * decay * 5 * intensity
      const sy = reducedMotion ? 1 : 1 + Math.sin(p * Math.PI * 3) * decay * 0.06 * intensity
      return {
        transform: `rotate(${deg.toFixed(2)}deg) scaleY(${sy.toFixed(4)})`,
        borderColor: p < 0.6 ? color : ''
      }
    }),
    options: { duration: durationMs, easing: 'linear' }
  })
})

registerVfxPreset({
  id: 'flash',
  label: 'Flash',
  tone: 'ok',
  defaultDurationMs: 420,
  build: ({ color, intensity, durationMs }) => ({
    keyframes: [
      { opacity: 1, borderColor: color, boxShadow: glowShadow(color, 22 * intensity, 90) },
      { opacity: 0.72, borderColor: color, boxShadow: glowShadow(color, 12 * intensity, 55), offset: 0.35 },
      { opacity: 1, boxShadow: 'none' }
    ],
    options: { duration: durationMs, easing: 'ease-out' }
  })
})

registerVfxPreset({
  id: 'fadeIn',
  label: 'Fade in',
  tone: 'accent',
  defaultDurationMs: 320,
  build: ({ durationMs, reducedMotion }) => ({
    keyframes: [
      { opacity: 0, transform: reducedMotion ? 'none' : 'translateY(4px)' },
      { opacity: 1, transform: 'none' }
    ],
    options: { duration: durationMs, easing: 'ease-out', fill: 'backwards' }
  })
})

registerVfxPreset({
  id: 'fadeOut',
  label: 'Fade out',
  tone: 'accent',
  defaultDurationMs: 280,
  build: ({ durationMs, reducedMotion }) => ({
    keyframes: [
      { opacity: 1, transform: 'none' },
      { opacity: 0, transform: reducedMotion ? 'none' : 'translateY(4px)' }
    ],
    options: { duration: durationMs, easing: 'ease-in', fill: 'forwards' }
  })
})

registerVfxPreset({
  id: 'glitch',
  label: 'Glitch',
  tone: 'alert',
  defaultDurationMs: 480,
  build: ({ color, intensity, durationMs, reducedMotion }) => ({
    keyframes: sampleCurve(8, (p) => {
      const jitter = reducedMotion ? 0 : (p % 0.25 < 0.12 ? 1 : -1) * (1 - p) * 5 * intensity
      const dip = p > 0.2 && p < 0.7 ? 0.55 : 1
      return {
        transform: `translateX(${jitter.toFixed(1)}px)`,
        opacity: dip,
        borderColor: p < 0.8 ? (Math.floor(p * 8) % 2 === 0 ? color : 'var(--color-cyan)') : '',
        boxShadow: p < 0.75 ? glowShadow(color, 12 * intensity, 65) : 'none'
      }
    }),
    options: { duration: durationMs, easing: 'steps(2, end)' }
  })
})

registerVfxPreset({
  id: 'highlight',
  label: 'Highlight',
  tone: 'cyan',
  defaultDurationMs: 1200,
  build: ({ color, intensity, durationMs, reducedMotion, loop }) => ({
    keyframes: sampleCurve(8, (p) => {
      const wave = Math.sin(p * Math.PI)
      const scale = reducedMotion ? 1 : 1 + wave * 0.04 * intensity
      return {
        transform: `scale(${scale.toFixed(4)})`,
        borderColor: wave > 0.1 ? color : '',
        boxShadow: wave > 0.05 ? `${glowShadow(color, 22 * wave * intensity, 85 * wave)}, inset ${glowShadow(color, 10 * wave * intensity, 40 * wave)}` : 'none'
      }
    }),
    options: { duration: durationMs, easing: 'ease-in-out', iterations: loop ? Infinity : 1 }
  })
})
