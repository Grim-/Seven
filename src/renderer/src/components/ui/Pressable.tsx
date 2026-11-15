import type { HTMLAttributes, KeyboardEvent } from 'react'

export function Pressable({ onClick, onKeyDown, ...rest }: HTMLAttributes<HTMLDivElement>) {
  const keys = (e: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e)
    if (e.defaultPrevented || e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return
    e.preventDefault()
    e.currentTarget.click()
  }
  return <div role="button" tabIndex={0} onClick={onClick} onKeyDown={keys} {...rest} />
}
