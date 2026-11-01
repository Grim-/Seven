import { MOODS, DONE } from '../../engine/present/define'
import { ToolError, optStr, type ToolDef } from '../../engine/tools/types'
import { data } from '../../engine/data/hub'
import { agentAccess } from '../../engine/agents/access'
import { canSee, linkPart, partView } from '../../engine/library/kinds'
import type { SceneActor, SceneBeat, ViewRef } from '@shared/types'
import { isHex } from '@shared/theme'

export const SCENE_BEATS = ['enter', 'exit', 'say', 'act', 'narrate', 'show', 'cue', 'wait'] as const
const MAX_BEATS = 40

const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

function soundId(ref: string): string {
  const a = data.assets.exists(ref) ? data.assets.get(ref) : data.assets.findByName(ref, (x) => x.kind === 'audio')
  if (!a || a.kind !== 'audio') throw new ToolError(`There is no sound file "${ref}" in the library. Find sound files with find, kind file, or set sound to null.`)
  return a.id
}

export const sceneTool: ToolDef = {
  name: 'scene',
  group: 'story',
  needsWorkspace: false,
  maxRepeats: 1,
  permission: 'none',
  activity: () => 'setting the scene',
  description: 'Play a scene on stage: beats in order, paced and voiced by Seven. Characters are agents or pages (their picture and voice are used) or any name.',
  params: {
    type: 'object',
    properties: {
      title: { type: ['string', 'null'] },
      where: { enum: ['stage', 'inline', null], description: 'stage (usual) or inline' },
      beats: {
        type: 'array',
        minItems: 1,
        maxItems: MAX_BEATS,
        items: {
          type: 'object',
          properties: {
            do: { enum: [...SCENE_BEATS] },
            who: { type: ['string', 'null'], description: 'For enter, exit, say, act' },
            text: { type: ['string', 'null'], description: 'For say, act, narrate' },
            mood: { enum: [...MOODS, null] },
            thing: { type: ['string', 'null'], description: 'For show: a library entry link; end it with #part for one part' },
            sound: { type: ['string', 'null'], description: 'For cue: a sound file' },
            flash: { type: ['string', 'null'], description: 'For cue: a hex colour' },
            shake: { type: ['boolean', 'null'] },
            seconds: { type: ['number', 'null'], description: 'For wait, or how long a show stays (default 3)' }
          }
        }
      }
    }
  },
  async execute(params, ctx) {
    const raw = Array.isArray(params.beats) ? (params.beats as Record<string, unknown>[]) : []
    if (!raw.length) throw new ToolError('A scene needs beats. Call scene again with beats as a list, e.g. [{"do": "narrate", "text": "Night falls."}].')
    if (raw.length > MAX_BEATS) throw new ToolError(`A scene has at most ${MAX_BEATS} beats and this one has ${raw.length}. Call scene again with ${MAX_BEATS} beats or fewer.`)
    const kctx = { agentId: ctx.agentId }
    const cast = new Map<string, SceneActor>()
    const actor = (name: string): string => {
      const key = name.toLowerCase()
      if (cast.has(key)) return key
      const agent = agentAccess.list().find((a) => a.name.toLowerCase() === key)
      const page = !agent && canSee('page', kctx) ? data.pages.find(name) : null
      cast.set(key, { name: agent?.name ?? page?.title ?? name, agentId: agent?.id ?? null, image: page?.image ?? null, voice: agent?.voice ?? page?.voice ?? null })
      return key
    }
    const beats: SceneBeat[] = raw.map((b, i) => {
      const n = i + 1
      const kind = SCENE_BEATS.includes(b.do as (typeof SCENE_BEATS)[number]) ? (b.do as SceneBeat['do']) : null
      if (!kind) throw new ToolError(`Beat ${n}: set do to one of: ${SCENE_BEATS.join(', ')}.`)
      const who = s(b.who)
      const text = s(b.text)
      const beat: SceneBeat = { do: kind, who: null, text: null, mood: MOODS.includes(b.mood as string) ? (b.mood as string) : null, view: null, sound: null, flash: null, shake: false, seconds: null }
      if (kind === 'enter' || kind === 'exit' || kind === 'say' || kind === 'act') {
        if (!who) throw new ToolError(`Beat ${n} (${kind}) needs who: an agent's name, a page's name or any character's name.`)
        beat.who = actor(who)
      }
      if (kind === 'say' || kind === 'act' || kind === 'narrate') {
        if (!text) throw new ToolError(`Beat ${n} (${kind}) needs text: the words for it.`)
        beat.text = text.slice(0, 1500)
      }
      if (kind === 'show') {
        const thing = s(b.thing)
        if (!thing) throw new ToolError(`Beat ${n} (show) needs thing: a library entry, as a link like @page:Name. Find entries with find.`)
        let view: ViewRef
        try {
          view = partView(thing, linkPart(thing), null, kctx)
        } catch (err) {
          throw new ToolError(`Beat ${n} (show): ${err instanceof Error ? err.message : String(err)}`)
        }
        beat.view = view
      }
      if (kind === 'cue') {
        const sound = s(b.sound)
        const flash = s(b.flash)
        if (flash && !isHex(flash)) throw new ToolError(`Beat ${n} (cue): flash must be a hex colour like "#ffffff"`)
        if (!sound && !flash && b.shake !== true) throw new ToolError(`Beat ${n} (cue) needs sound, flash or shake, e.g. flash "#ffffff" or shake true.`)
        beat.sound = sound ? soundId(sound) : null
        beat.flash = flash || null
        beat.shake = b.shake === true
      }
      if (typeof b.seconds === 'number' && b.seconds > 0) beat.seconds = Math.min(15, b.seconds)
      if (kind === 'wait' && !beat.seconds) beat.seconds = 2
      return beat
    })
    const narrator = ctx.agentId ? agentAccess.get(ctx.agentId) : null
    const title = optStr(params, 'title')?.trim() || 'Scene'
    const where = params.where === 'inline' ? 'inline' : 'stage'
    const fields = { title, beats, cast: Object.fromEntries(cast), narrator: { agentId: narrator?.id ?? null, voice: narrator?.voice ?? null } }
    return {
      text: `Scene "${title}" (${beats.length} beats) ${where === 'stage' ? 'played on stage' : 'shown in the chat'}. ${DONE}`,
      view: { kind: 'present', title, data: { type: 'scene', fields, where, key: null } }
    }
  }
}
