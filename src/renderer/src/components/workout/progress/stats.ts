import { shortDate } from './chartStyle'
import { parseDay } from '@shared/workoutStats'

export * from '@shared/workoutStats'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function dayLabel(date: string): string {
  return `${DAYS[parseDay(date).getDay()]} ${shortDate(date)}`
}

export function metricText(n: number): string {
  return n.toLocaleString()
}
