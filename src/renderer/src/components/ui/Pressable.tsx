import type { HTMLAttributes, KeyboardEvent } from 'react'

export function Pressable({ onClick, onKeyDown, inline = false, ...rest }: HTMLAttributes<HTMLDivElement> & { inline?: boolean }) {
  const keys = (e: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e)
    if (e.defaultPrevented || e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return
    e.preventDefault()
    e.currentTarget.click()
  }
  const props = { role: 'button', tabIndex: 0, onClick, onKeyDown: keys, ...rest }
  return inline ? <span {...(props as HTMLAttributes<HTMLSpanElement>)} /> : <div {...props} />
}
