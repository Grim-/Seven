import { registerSettingType } from './spec'

const MAX_FRAMES = 40
const MAX_FRAME = 600

registerSettingType({
  type: 'frames',
  schema: () => ({ type: 'array', items: { type: 'string' }, description: 'Text frames shown in turn' }),
  clean: (_spec, value) => {
    if (!Array.isArray(value)) return undefined
    const frames = value.filter((f): f is string => typeof f === 'string' && f.length > 0).slice(0, MAX_FRAMES).map((f) => f.slice(0, MAX_FRAME))
    return frames.length ? frames : undefined
  }
})
