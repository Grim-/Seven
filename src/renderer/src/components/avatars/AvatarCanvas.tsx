import { useEffect, useRef } from 'react'
import { stackBleed, type Avatar } from '@shared/avatars'
import { cn } from '../../lib/cn'
import { useAnimated } from '../animated/useAnimated'
import { avatarDrawer } from './drawers'
import type { SignalSource } from './signals'
import './register'

export function AvatarCanvas({ avatar, source }: { avatar: Avatar; source: SignalSource }) {
  const latest = useRef(avatar)
  latest.current = avatar
  const Maker = avatarDrawer(avatar.renderer)
  const key = `${avatar.renderer}:${avatar.id}`
  const { canvas, live } = useAnimated(Maker ? () => new Maker(latest.current, source) : null, key)
  const output = useRef<HTMLCanvasElement>(null)
  const treated = Boolean(avatar.treatments?.length)
  const bleed = stackBleed(avatar.treatments) * 100
  useEffect(() => live.current?.setAvatar(avatar), [avatar, live])
  useEffect(() => live.current?.setOutput(treated ? output.current : null), [treated, key, live])
  return (
    <>
      <canvas ref={canvas} className={cn('absolute inset-0 h-full w-full font-ui', treated && 'invisible')} />
      {treated && <canvas ref={output} style={{ left: `${-bleed}%`, top: `${-bleed}%`, width: `${100 + bleed * 2}%`, height: `${100 + bleed * 2}%` }} className="pointer-events-none absolute" />}
    </>
  )
}
