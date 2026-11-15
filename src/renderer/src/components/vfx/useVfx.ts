import { useEffect, useRef, type RefObject } from 'react'
import { subscribeVfx, type VfxCue } from '../../store/vfx'
import { resolveVfxColor, vfxPreset } from './registry'
import './presets'

const activeAnimations = new WeakMap<HTMLElement, Animation>()

const prefersReducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

export function runVfx(el: HTMLElement | null, cue: VfxCue): Animation | null {
  if (!el || typeof el.animate !== 'function') return null
  const preset = vfxPreset(cue.preset)
  if (!preset) return null
  activeAnimations.get(el)?.cancel()
  const built = preset.build({
    color: resolveVfxColor(preset, cue.color),
    intensity: cue.intensity ?? 1,
    durationMs: cue.durationMs ?? preset.defaultDurationMs,
    reducedMotion: prefersReducedMotion(),
    loop: cue.loop
  })
  const anim = el.animate(built.keyframes, built.options)
  activeAnimations.set(el, anim)
  anim.onfinish = () => {
    if (activeAnimations.get(el) === anim) activeAnimations.delete(el)
  }
  anim.oncancel = () => {
    if (activeAnimations.get(el) === anim) activeAnimations.delete(el)
  }
  return anim
}

export function useVfx<T extends HTMLElement = HTMLElement>(
  targets: string | (string | null | undefined)[] | null | undefined,
  cue?: VfxCue | null
): RefObject<T | null> {
  const ref = useRef<T | null>(null)
  const list = (Array.isArray(targets) ? targets : [targets]).filter((t): t is string => Boolean(t))
  const key = list.join('\0')

  useEffect(() => {
    if (!key) return
    const unsubs = key.split('\0').map((target) => subscribeVfx(target, (c) => runVfx(ref.current, c)))
    return () => unsubs.forEach((u) => u())
  }, [key])

  useEffect(() => {
    if (!cue) return
    const anim = runVfx(ref.current, cue)
    return () => anim?.cancel()
  }, [cue?.preset, cue?.color, cue?.intensity, cue?.durationMs, cue?.loop])

  return ref
}
