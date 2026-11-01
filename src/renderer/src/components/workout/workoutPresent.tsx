import type { WorkoutViewData } from '@shared/types'
import { WorkoutGlance, WorkoutResult } from './Workout'
import { ExerciseScreen } from './WorkoutScreens'
import type { EntrySurfaceProps } from '../../registries/kinds'

export function WorkoutChat({ id, part }: EntrySurfaceProps) {
  if (part === 'glance') return <WorkoutGlance />
  return <WorkoutResult data={{ mode: part as WorkoutViewData['mode'], workout: id }} />
}

export function ExerciseChat({ kind, id }: EntrySurfaceProps) {
  return <ExerciseScreen kind={kind} id={id} select={() => undefined} />
}

export function WorkoutWidget() {
  return <WorkoutGlance />
}
