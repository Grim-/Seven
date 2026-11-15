import { normalizeFrame, registerSettingType, type FrameEntry } from './spec'

const MAX_FRAMES = 40
const MAX_FRAME = 600
const MAX_MEDIA = 120

function cleanEntry(raw: unknown): FrameEntry | null {
  if (typeof raw === 'string') return raw.length > 0 ? raw.slice(0, MAX_FRAME) : null
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as { text?: unknown; media?: unknown }
  const text = typeof r.text === 'string' ? r.text.slice(0, MAX_FRAME) : ''
  const media = typeof r.media === 'string' ? r.media.trim().slice(0, MAX_MEDIA) : ''
  if (!text.length && !media) return null
  return normalizeFrame(text, media)
}

registerSettingType({
  type: 'frames',
  schema: () => ({
    type: 'array',
    items: {
      oneOf: [
        { type: 'string' },
        {
          type: 'object',
          properties: {
            text: { type: 'string' },
            media: { type: 'string', description: 'Optional Seven image/GIF/video asset ID for this frame' }
          }
        }
      ]
    },
    description: 'Text and/or media frames shown in turn'
  }),
  clean: (spec, value) => {
    if (!Array.isArray(value)) return undefined
    const frames = value.map(cleanEntry).filter((f): f is FrameEntry => f !== null).slice(0, MAX_FRAMES)
    if (frames.length) return frames
    return Array.isArray(spec.default) && !spec.default.length ? [] : undefined
  }
})
