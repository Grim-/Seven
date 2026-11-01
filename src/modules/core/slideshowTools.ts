import { NEW_SLIDESHOW, type Slideshow, type SlideshowData } from '@shared/slideshow'
import { ToolError, str, type ToolDef } from '../../engine/tools/types'
import { resolveFile } from '../../engine/library/files'
import { createSlideshow, findSlideshow, getSlideshow, saveSlideshow, slideshowIds } from '../../engine/library/slideshows'

function pictureIds(value: unknown, field: string): string[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) throw new ToolError(`Give ${field} as a list of pictures, e.g. ["@file:harbour.png"].`)
  const problems: string[] = []
  const ids: string[] = []
  for (const raw of value) {
    try {
      ids.push(resolveFile(String(raw), ['image'], 'a picture').id)
    } catch (err) {
      problems.push(err instanceof Error ? err.message : String(err))
    }
  }
  if (problems.length) throw new ToolError(`Nothing was saved. ${problems.join(' ')}`)
  return ids
}

function settings(params: Record<string, unknown>, base: SlideshowData): SlideshowData {
  const next = { ...base }
  if (params.seconds !== undefined && params.seconds !== null) {
    if (typeof params.seconds !== 'number' || !(params.seconds > 0)) throw new ToolError('seconds is how long each picture shows, a number above 0, e.g. 8.')
    next.seconds = params.seconds
  }
  if (typeof params.shuffle === 'boolean') next.shuffle = params.shuffle
  if (params.fit === 'whole' || params.fit === 'fill') next.fit = params.fit === 'fill' ? 'cover' : 'contain'
  if (typeof params.captions === 'boolean') next.captions = params.captions
  return next
}

function summary(s: Slideshow, added = 0, removed = 0): string {
  const change = [added ? `${added} added` : '', removed ? `${removed} removed` : ''].filter(Boolean).join(', ')
  return `Slideshow "${s.title}"${change ? ` (${change})` : ''}: ${s.pictures.length} picture${s.pictures.length === 1 ? '' : 's'}, ${s.seconds} seconds each, ${s.shuffle ? 'shuffled' : 'in order'}. Show it with show (@slideshow:${s.title}), put it on a board with add_to_board, or make it the chat background with ambience slideshow.`
}

const SETTINGS = {
  seconds: { type: ['number', 'null'], description: 'Seconds per picture' },
  shuffle: { type: ['boolean', 'null'], description: 'true plays them in random order' },
  fit: { enum: ['whole', 'fill', null], description: 'whole shows each picture complete; fill crops to fill the space' },
  captions: { type: ['boolean', 'null'], description: 'true shows each picture\'s name' }
} as const

const addSlideshow: ToolDef = {
  name: 'add_slideshow',
  group: 'core',
  needsWorkspace: false,
  description: 'Make a slideshow.',
  params: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Its name, e.g. holiday_2025' },
      pictures: { type: 'array', items: { type: 'string' }, description: 'Picture links or file ids, e.g. @file:beach.png' },
      ...SETTINGS
    }
  },
  async execute(params) {
    const name = str(params, 'name').trim()
    if (findSlideshow(name)) throw new ToolError(`There is already a slideshow "${name}". Change it with update_slideshow.`)
    const pictures = pictureIds(params.pictures, 'pictures')
    return summary(createSlideshow(name, settings(params, { ...NEW_SLIDESHOW, pictures })), pictures.length)
  }
}

const updateSlideshow: ToolDef = {
  name: 'update_slideshow',
  group: 'core',
  needsWorkspace: false,
  description: 'Change a slideshow.',
  params: {
    type: 'object',
    properties: {
      slideshow: { type: 'string', description: 'Its name' },
      add: { oneOf: [{ type: 'null' }, { type: 'array', items: { type: 'string' } }], description: 'Pictures to add' },
      remove: { oneOf: [{ type: 'null' }, { type: 'array', items: { type: 'string' } }], description: 'Pictures to take out' },
      order: { oneOf: [{ type: 'null' }, { type: 'array', items: { type: 'string' } }], description: 'Every picture in the new order' },
      ...SETTINGS
    }
  },
  async execute(params) {
    const ref = str(params, 'slideshow').trim()
    const id = findSlideshow(ref)
    if (!id) throw new ToolError(`There is no slideshow "${ref}". Slideshows: ${slideshowIds().map((s) => s.title).join(', ') || 'none yet'}.`)
    const current = getSlideshow(id)
    const order = pictureIds(params.order, 'order')
    const add = pictureIds(params.add, 'add')
    const remove = new Set(pictureIds(params.remove, 'remove'))
    const missing = [...remove].filter((p) => !current.pictures.includes(p))
    if (missing.length) throw new ToolError(`Nothing was saved: ${missing.length} of the pictures in remove ${missing.length === 1 ? "isn't" : "aren't"} in the slideshow.`)
    const base = order.length ? order : current.pictures
    const pictures = [...base.filter((p) => !remove.has(p)), ...add.filter((p) => !base.includes(p))]
    return summary(saveSlideshow(id, settings(params, { ...current, pictures })), add.length, remove.size)
  }
}

export const SLIDESHOW_TOOLS: ToolDef[] = [addSlideshow, updateSlideshow]
