import type { ComponentType } from 'react'
import type { KindScreenProps } from '../../registries/kinds'

export function panelScreen(Component: ComponentType<{ initial?: string | null }>) {
  return function Screen({ id }: KindScreenProps) {
    return <Component key={id ?? 'all'} initial={id} />
  }
}
