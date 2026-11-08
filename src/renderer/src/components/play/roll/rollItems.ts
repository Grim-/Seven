import type { MenuItem } from '../../ui/ContextMenu'

export const ROLL_TOOLTIP_NO_CHAR =
  "It's your world. No valid characters can make this check, but you can still pick Pass or Fail, or close this off until you're ready."

export function rollItems({
  ready,
  sending = false,
  onRoll,
  onPass,
  onFail,
  onClose,
  closeLabel = 'Close'
}: {
  ready: boolean
  sending?: boolean
  onRoll: () => void | Promise<void>
  onPass: () => void | Promise<void>
  onFail: () => void | Promise<void>
  onClose?: () => void | Promise<void>
  closeLabel?: string
}): MenuItem[] {
  const hint = !ready ? ROLL_TOOLTIP_NO_CHAR : undefined
  return [
    {
      label: 'Roll',
      disabled: !ready || sending,
      hint,
      onSelect: onRoll
    },
    {
      label: 'Pass',
      disabled: sending,
      hint,
      onSelect: onPass
    },
    {
      label: 'Fail',
      disabled: sending,
      hint,
      onSelect: onFail
    },
    ...(onClose
      ? [
          {
            label: closeLabel,
            disabled: sending,
            hint,
            onSelect: onClose
          }
        ]
      : [])
  ]
}
