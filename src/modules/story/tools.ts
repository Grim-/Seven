import { MOODS, presentationTool } from '../../engine/present/define'
import { ToolError } from '../../engine/tools/types'
import { data } from '../../engine/data/hub'
import { agentAccess } from '../../engine/agents/access'
import { HANDOUT_STYLES } from '@shared/handouts'

const moodField = { enum: [...MOODS, null], description: 'The speaker\'s mood, drawn on their picture, or null' }
const imageField = (what: string) => ({ type: ['string', 'null'] as ['string', 'null'], description: `${what}: a file id from Data, or null` })

function pictures(): string {
  const list = data.assets.list().filter((a) => a.kind === 'image')
  return list.length ? `Pictures: ${list.slice(0, 15).map((a) => `${a.name} (${a.id})`).join(', ')}${list.length > 15 ? `, and ${list.length - 15} more (find with kind file)` : ''}` : 'There are no pictures in the library yet'
}

function checkImage(fields: Record<string, unknown>, key = 'image'): void {
  const value = fields[key]
  if (typeof value !== 'string' || !value.trim()) return
  const ref = value.trim()
  const asset = data.assets.exists(ref) ? data.assets.get(ref) : data.assets.findByName(ref)
  if (!asset) throw new ToolError(`There is no picture "${ref}". ${pictures()}. Or use null.`)
  if (asset.kind !== 'image' && asset.kind !== 'video') throw new ToolError(`"${asset.name}" is a ${asset.kind} file, not a picture. ${pictures()}.`)
  fields[key] = asset.id
}

function checkCharacter(value: unknown): void {
  if (typeof value !== 'string' || !value.trim()) return
  const names = agentAccess.list().map((a) => a.name)
  if (!names.some((n) => n.toLowerCase() === value.trim().toLowerCase())) throw new ToolError(`There is no agent called "${value}". Agents: ${names.join(', ')}. For anyone else, give the panel a picture instead.`)
}

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

export const STORY_TOOLS = [
  presentationTool({
    type: 'dialogue',
    group: 'story',
    description: 'Show a game-style dialogue box: a speaker with their picture and what they say or do. Put spoken words in double quotes; they are highlighted.',
    fields: {
      speaker: { type: ['string', 'null'], description: 'Who speaks: an agent\'s name, any character\'s name, or null for yourself' },
      mood: moodField,
      text: { type: 'string', description: 'What is said and done. Spoken words in "double quotes".' },
      image: imageField('A picture for a speaker who is not an agent')
    },
    check: (f) => {
      if (!text(f.text)) throw new ToolError('present_dialogue needs text. Call it again with text set to what is said and done, spoken words in "double quotes".')
      checkImage(f)
    },
    title: (f) => text(f.speaker) || 'Dialogue'
  }),
  presentationTool({
    type: 'comic',
    group: 'story',
    description: 'Show a comic strip of 1 to 6 panels. Each panel has a picture (a file id, or an agent drawn large), an optional caption box and an optional speech bubble.',
    fields: {
      title: { type: ['string', 'null'], description: 'Strip title, or null' },
      panels: {
        type: 'array',
        minItems: 1,
        maxItems: 6,
        items: {
          type: 'object',
          properties: {
            image: imageField('The panel picture'),
            character: { type: ['string', 'null'], description: 'An agent to draw large when there is no picture, or null' },
            mood: moodField,
            caption: { type: ['string', 'null'], description: 'Narration box text, or null' },
            speech: { type: ['string', 'null'], description: 'Speech bubble text, or null' }
          }
        }
      }
    },
    check: (f) => {
      const panels = Array.isArray(f.panels) ? (f.panels as Record<string, unknown>[]) : []
      if (!panels.length) throw new ToolError('present_comic needs at least one panel. Call it again with panels as a list, e.g. [{"caption": "Meanwhile...", "speech": "Hi!"}].')
      for (const p of panels) {
        checkImage(p)
        checkCharacter(p.character)
      }
    },
    title: (f) => text(f.title) || 'Comic'
  }),
  presentationTool({
    type: 'reveal',
    group: 'story',
    description: 'Reveal something dramatically with a transition: a title, text and/or a picture. Best with where "stage".',
    fields: {
      transition: { enum: ['fade', 'flash', 'shake', 'iris', 'slide', 'glitch', 'zoom'], description: 'How it appears' },
      seconds: { type: ['number', 'null'], description: 'How long the transition takes, 0.5 to 10 (default 2.5)' },
      title: { type: ['string', 'null'], description: 'Big title text, or null' },
      text: { type: ['string', 'null'], description: 'Text under it, in markdown, or null' },
      image: imageField('A picture to reveal')
    },
    check: (f) => {
      if (!text(f.title) && !text(f.text) && !text(f.image)) throw new ToolError('present_reveal needs something to reveal. Call it again with title, text or image set.')
      checkImage(f)
    },
    title: (f) => text(f.title) || 'Reveal'
  }),
  presentationTool({
    type: 'handout',
    group: 'story',
    fixed: true,
    description: 'Hand the user an in-world prop they can keep: a letter, a scrap of note, a poster or a terminal readout, with its text and an optional picture.',
    fields: {
      style: { enum: [...HANDOUT_STYLES], description: 'What it looks like' },
      title: { type: ['string', 'null'], description: 'Heading, or null' },
      text: { type: 'string', description: 'What it says, in markdown' },
      from: { type: ['string', 'null'], description: 'Who signed or sent it, or null' },
      image: imageField('A picture on it')
    },
    check: (f) => {
      if (!text(f.text)) throw new ToolError('handout needs text: what the letter, note, poster or readout says.')
      checkImage(f)
    },
    title: (f) => text(f.title) || 'Handout',
    result: () => 'Handed over. The user can keep it in their journal. Carry on with the scene.'
  })
]
