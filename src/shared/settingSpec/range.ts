import { registerSettingType } from './spec'

registerSettingType({
  type: 'range',
  schema: (spec) => ({ type: 'number', minimum: spec.min, maximum: spec.max }),
  clean: (spec, value) => (typeof value === 'number' && Number.isFinite(value) ? Math.min(spec.max ?? value, Math.max(spec.min ?? value, value)) : undefined)
})
