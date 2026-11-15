import { useEffect, useRef } from 'react'
import type { Avatar } from '@shared/avatars'
import { useAnimated } from '../animated/useAnimated'
import { avatarDrawer } from './drawers'
import type { SignalSource } from './signals'
import './register'

export function AvatarCanvas({ avatar, source }: { avatar: Avatar; source: SignalSource }) {
  const latest = useRef(avatar)
  latest.current = avatar
  const Maker = avatarDrawer(avatar.renderer)
  const { canvas, live } = useAnimated(Maker ? () => new Maker(latest.current, source) : null, `${avatar.renderer}:${avatar.id}`)
  useEffect(() => live.current?.setAvatar(avatar), [avatar, live])
  return <canvas ref={canvas} className="absolute inset-0 h-full w-full font-mono" />
}
