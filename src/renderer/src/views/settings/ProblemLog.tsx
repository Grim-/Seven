import { PROBLEM_LIMITS, type ProblemPrefs } from '@shared/problems'
import { SettingCard, SettingRow, SliderNumber } from '../../components/ui'
import { useApp } from '../../store/app'
import { failed } from '../../lib/notify'

const ROWS: { key: keyof ProblemPrefs; label: string; hint: string }[] = [
  { key: 'keep', label: 'Problems kept', hint: 'How many problems the Notifications panel keeps. A problem that happens again is counted on its row instead of adding a new one.' },
  { key: 'stderrLines', label: 'Engine output kept for crashes', hint: 'The last lines the engine printed, attached to the problem when it stops unexpectedly. 0 keeps none.' }
]

export function ProblemLog() {
  const prefs = useApp((s) => s.settings?.problems)
  const update = useApp((s) => s.updateSettings)
  if (!prefs) return null
  const set = (key: keyof ProblemPrefs, value: number) => void update({ problems: { ...prefs, [key]: value } }).catch(failed('Could not save the setting'))
  return (
    <SettingCard title="Problems">
      {ROWS.map((row) => (
        <SettingRow key={row.key} label={row.label} hint={row.hint}>
          <SliderNumber value={prefs[row.key]} min={PROBLEM_LIMITS[row.key].min} max={PROBLEM_LIMITS[row.key].max} onChange={(v) => set(row.key, v)} />
        </SettingRow>
      ))}
    </SettingCard>
  )
}
