import { ToolError, str, type ToolDef } from '../../engine/tools/types'
import { data } from '../../engine/data/hub'
import { player } from '../../engine/player'
import type { PlayerAction } from '@shared/types'

function audioFiles() {
  return data.assets.list().filter((a) => a.kind === 'audio')
}

function track(ref: string): string {
  const r = ref.trim()
  const key = r.toLowerCase()
  const all = audioFiles()
  const found = all.find((a) => a.id === r) ?? data.assets.findByName(r, (a) => a.kind === 'audio')
  if (found) return found.id
  const close = all.filter((a) => a.name.toLowerCase().includes(key)).slice(0, 8)
  const offer = (close.length ? close : all.slice(0, 12)).map((a) => a.name).join(', ')
  throw new ToolError(all.length ? `There is no audio file "${r}". ${close.length ? 'Close' : 'Audio in the library'}: ${offer}` : 'There is no audio in the library yet.')
}

const play: ToolDef = {
  name: 'play',
  group: 'player',
  needsWorkspace: false,
  command: true,
  activity: () => 'putting something on',
  description: 'Play audio files from the library, by name or id. queue=true adds them after what is playing instead.',
  params: {
    type: 'object',
    properties: {
      files: { type: 'array', items: { type: 'string' }, description: 'Audio file names or ids, in order' },
      queue: { type: ['boolean', 'null'], description: 'true: add to the queue. null or false: play now' }
    }
  },
  async execute(params) {
    const refs = Array.isArray(params.files) ? params.files.map(String).filter((s) => s.trim()) : []
    if (!refs.length) throw new ToolError(`Name at least one audio file. ${audioFiles().length ? `Audio in the library: ${audioFiles().slice(0, 12).map((a) => a.name).join(', ')}` : 'There is no audio in the library yet.'}`)
    const ids = refs.map(track)
    const queue = params.queue === true
    player.command({ action: queue ? 'queue' : 'play', assetIds: ids })
    return `${queue ? 'Queued' : 'Playing'} ${ids.length} track${ids.length === 1 ? '' : 's'}.`
  }
}

const ACTIONS = ['pause', 'resume', 'next', 'previous', 'stop', 'status'] as const

const control: ToolDef = {
  name: 'player',
  group: 'player',
  needsWorkspace: false,
  command: true,
  activity: () => 'working the player',
  description: "Control the media player: pause, resume, next, previous, stop, or status to hear what's on and queued.",
  params: { type: 'object', properties: { action: { enum: [...ACTIONS] } } },
  async execute(params) {
    const action = str(params, 'action') as (typeof ACTIONS)[number]
    if (!ACTIONS.includes(action)) throw new ToolError(`action is one of ${ACTIONS.join(', ')}`)
    if (action === 'status') {
      const s = player.state()
      if (!s.queue.length) return 'Nothing is queued.'
      const now = s.queue[s.index]
      const next = s.queue.slice(s.index + 1, s.index + 6).map((t) => t.name)
      return `${s.playing ? 'Playing' : 'Paused on'} ${now?.name ?? 'nothing'}.${next.length ? ` Next: ${next.join(', ')}.` : ' Nothing after it.'}`
    }
    player.command({ action: action as PlayerAction, assetIds: [] })
    return 'Done.'
  }
}

export const PLAYER_TOOLS: ToolDef[] = [play, control]
