import type { CharacterStatus } from './characterStatus'
import { HealthBar } from './HealthBar'

export const healthText = (s: CharacterStatus) => (s.health ? `${s.health.cur}/${s.health.max}${s.health.temp > 0 ? ` +${s.health.temp}` : ''}` : '')

export function StatusDetails({ status }: { status: CharacterStatus }) {
  return (
    <div className="flex flex-col gap-1.5">
      {status.health && (
        <div className="flex items-center gap-2">
          <HealthBar health={status.health} className="flex-1" />
          <span className="font-mono text-[11px] text-white">{healthText(status)}</span>
        </div>
      )}
      {status.effects.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {status.effects.map((e) => (
            <span key={e} className="shell-tag text-[10px]">
              {e}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
