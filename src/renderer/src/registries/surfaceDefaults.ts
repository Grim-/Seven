import type { ComponentType } from 'react'
import type { EntrySlateProps } from './kinds'
import type { WidgetUi } from './widgets'

export const surfaceDefaults: { slate?: ComponentType<EntrySlateProps>; widget?: WidgetUi } = {}
