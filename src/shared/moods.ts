export interface MoodDef {
  name: string
  label: string
  energy: number
  warmth: number
  description: string
}

export const MOODS = [
  { name: 'idle', label: 'Calm', energy: 0, warmth: 0, description: 'neutral, at rest' },
  { name: 'happy', label: 'Happy', energy: 0.3, warmth: 0.8, description: 'pleased, friendly' },
  { name: 'laughing', label: 'Laughing', energy: 0.9, warmth: 0.9, description: 'amused, laughing' },
  { name: 'sad', label: 'Sad', energy: -0.7, warmth: -0.2, description: 'down, sorry' },
  { name: 'angry', label: 'Angry', energy: 0.9, warmth: -0.9, description: 'furious, hostile' },
  { name: 'error', label: 'Glitched', energy: 0.6, warmth: -0.6, description: 'broken, something went wrong' }
] as const satisfies readonly MoodDef[]

export type MoodName = (typeof MOODS)[number]['name']

export const MOOD_NAMES: MoodName[] = MOODS.map((m) => m.name)

export const NEUTRAL_MOOD: MoodName = 'idle'

export const FAILED_MOOD: MoodName = 'error'

export function moodDef(name: string | null | undefined): MoodDef | null {
  return MOODS.find((m) => m.name === name) ?? null
}

export function isMood(value: unknown): value is MoodName {
  return MOODS.some((m) => m.name === value)
}

export function nearestMood(energy: number, warmth: number, among: string[]): string | null {
  let best: string | null = null
  let dist = Infinity
  for (const m of MOODS) {
    if (!among.includes(m.name)) continue
    const d = (m.energy - energy) ** 2 + (m.warmth - warmth) ** 2
    if (d < dist) {
      dist = d
      best = m.name
    }
  }
  return best
}

export const ACTIVITIES = [
  { name: 'idle', label: 'Idle', previewRate: 0 },
  { name: 'listening', label: 'Listening', previewRate: 0 },
  { name: 'thinking', label: 'Thinking', previewRate: 0 },
  { name: 'tool', label: 'Using a tool', previewRate: 0 },
  { name: 'talking', label: 'Talking', previewRate: 0.6 }
] as const

export type Activity = (typeof ACTIVITIES)[number]['name']

export function isActivity(value: unknown): value is Activity {
  return ACTIVITIES.some((a) => a.name === value)
}

export interface AvatarPose {
  mood?: MoodName
  activity?: Activity
  energy?: number
  warmth?: number
  rate?: number
}

export function poseOf(name: unknown): AvatarPose | undefined {
  const pose: AvatarPose = { mood: isMood(name) ? name : undefined, activity: isActivity(name) ? name : undefined }
  return pose.mood || pose.activity ? pose : undefined
}

export const POSE_OPTIONS: { value: string; label: string }[] = [...ACTIVITIES.filter((a) => !isMood(a.name)).map((a) => ({ value: a.name, label: a.label })), ...MOODS.map((m) => ({ value: m.name, label: m.label }))]
