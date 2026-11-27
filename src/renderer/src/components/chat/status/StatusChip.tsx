import { showName } from '@shared/ids'
import { Eyebrow, Popover } from '../../ui'
import type { CharacterStatus } from './characterStatus'
import { HealthBar } from './HealthBar'
import { StatusDetails, healthText } from './StatusDetails'

export function StatusChip({ status }: { status: CharacterStatus }) {
  const shown = status.effects.slice(0, 2).join(', ')
  const more = status.effects.length - 2
  return (
    <Popover
      title={`${showName(status.name)}: health and effects`}
      side="bottom"
      align="start"
      className="w-64 gap-2 p-3"
      triggerClassName="h-7 gap-1.5 px-1 font-ui text-[10.5px] text-dim hover:text-ink"
      trigger={
        <>
          {status.health && <HealthBar health={status.health} className="w-14" />}
          {status.health && <span className="text-ink/85">{healthText(status)}</span>}
          {status.effects.length > 0 && (
            <>
              <span className="max-w-40 truncate text-tint-purple phone:hidden">
                {shown}
                {more > 0 ? ` +${more}` : ''}
              </span>
              <span className="hidden text-tint-purple phone:inline">+{status.effects.length}</span>
            </>
          )}
        </>
      }
    >
      <Eyebrow>{showName(status.name)}</Eyebrow>
      <StatusDetails status={status} />
    </Popover>
  )
}
