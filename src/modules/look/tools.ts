import { AVATAR_STATES, CODED_AVATARS, REACTIONS, type AgentLook, type AvatarState } from '@shared/types'
import { ToolError, optInt, optStr, type ToolDef } from '../../engine/tools/types'
import { data } from '../../engine/data/hub'
import { agentAccess } from '../../engine/agents/access'
import { presentationTool } from '../../engine/present/define'

const HEX = /^#[0-9a-f]{6}$/i

function agentOf(id: string | null): string {
  if (!id) throw new ToolError('This tool only works inside a chat with an agent')
  return id
}

function mediaFile(id: string): string {
  const meta = data.assets.metaFor(id)
  if (!meta) throw new ToolError(`There is no file "${id}". find with kind file lists the files there are.`)
  if (meta.kind !== 'image' && meta.kind !== 'video') throw new ToolError(`${meta.name} is not a picture, GIF or video. Give the id of one that is; find with kind file lists them.`)
  return meta.id
}

const react: ToolDef = {
  name: 'react',
  group: 'look',
  needsWorkspace: false,
  maxRepeats: 3,
  description: `Show a mood on your avatar and/or a quick effect. Moods: ${AVATAR_STATES.join(', ')}. Effects: ${Object.keys(REACTIONS).join(', ')}.`,
  params: {
    type: 'object',
    properties: {
      mood: { oneOf: [{ type: 'null' }, { enum: AVATAR_STATES }], description: 'A mood to show, or null' },
      effect: { oneOf: [{ type: 'null' }, { enum: Object.keys(REACTIONS) }], description: 'A quick effect, or null' },
      seconds: { type: ['integer', 'null'], description: 'How long the mood lasts (default 6)' }
    }
  },
  async execute(params, ctx) {
    const mood = (optStr(params, 'mood') as AvatarState | null) ?? null
    const effect = optStr(params, 'effect')
    if (!mood && !effect) throw new ToolError(`Set mood to one of: ${AVATAR_STATES.join(', ')}, or effect to one of: ${Object.keys(REACTIONS).join(', ')}, or both.`)
    const seconds = Math.min(60, Math.max(2, optInt(params, 'seconds') ?? 6))
    ctx.react(mood, effect, seconds)
    return `Shown${mood ? ` ${mood}` : ''}${mood && effect ? ' with' : ''}${effect ? ` ${effect}` : ''}.`
  }
}

const setAvatar: ToolDef = {
  name: 'set_avatar',
  group: 'look',
  needsWorkspace: false,
  description: `Change your avatar to a picture, GIF or short video (file id from attachments or show), or to an animated avatar: ${CODED_AVATARS.map((c) => c.id).join(', ')}.`,
  params: {
    type: 'object',
    properties: {
      file_id: { type: ['string', 'null'], description: 'A file id, or null' },
      animated: { oneOf: [{ type: 'null' }, { enum: CODED_AVATARS.map((c) => c.id) }], description: 'An animated avatar, or null' }
    }
  },
  async execute(params, ctx) {
    const id = agentOf(ctx.agentId)
    const file = optStr(params, 'file_id')
    const coded = optStr(params, 'animated')
    if (!file && !coded) throw new ToolError(`Set file_id to the id of a picture, GIF or video, or animated to one of: ${CODED_AVATARS.map((c) => c.id).join(', ')}.`)
    const avatar: AgentLook['avatar'] = file ? { kind: 'file', assetId: mediaFile(file) } : { kind: 'coded', type: coded! }
    const agent = agentAccess.updateLook(id, { avatar })
    return `Avatar changed for ${agent.name}.`
  }
}

const setTheme: ToolDef = {
  name: 'set_theme',
  group: 'look',
  needsWorkspace: false,
  description: 'Change your colours and background: accent colour, tint colour (hex like #22d3ee), background picture/GIF/video by file id. Use "none" to clear one.',
  params: {
    type: 'object',
    properties: {
      accent: { type: ['string', 'null'], description: 'Hex colour, "none", or null to keep' },
      tint: { type: ['string', 'null'], description: 'Hex colour, "none", or null to keep' },
      background_file_id: { type: ['string', 'null'], description: 'File id, "none", or null to keep' }
    }
  },
  async execute(params, ctx) {
    const id = agentOf(ctx.agentId)
    const patch: Partial<AgentLook> = {}
    const color = (key: 'accent' | 'tint') => {
      const v = optStr(params, key)
      if (v === null) return
      if (v.toLowerCase() === 'none') patch[key] = null
      else if (HEX.test(v.trim())) patch[key] = v.trim().toLowerCase()
      else throw new ToolError(`${key} must be a hex colour like #22d3ee, or "none"`)
    }
    color('accent')
    color('tint')
    const bg = optStr(params, 'background_file_id')
    if (bg !== null) patch.background = bg.toLowerCase() === 'none' ? null : mediaFile(bg)
    if (!Object.keys(patch).length) throw new ToolError('Nothing to change. Set at least one of accent, tint (a hex colour like #22d3ee, or "none") or background_file_id.')
    const agent = agentAccess.updateLook(id, patch)
    return `Theme updated for ${agent.name}.`
  }
}

const aside = presentationTool({
  type: 'aside',
  group: 'look',
  fixed: true,
  description: 'A short side remark in your own voice, shown apart from your answer: a thought, a joke, a reaction. Keep the answer itself in your reply.',
  fields: {
    text: { type: 'string', description: 'One or two sentences' }
  },
  check: (f) => {
    if (typeof f.text !== 'string' || !f.text.trim()) throw new ToolError('Give text: your side remark, one or two sentences.')
  },
  title: () => 'Aside',
  result: () => 'Shown beside your reply. Carry on with your answer.'
})

export const LOOK_TOOLS: ToolDef[] = [react, setAvatar, setTheme, aside]
