import { registerSettingType } from './spec'

registerSettingType({
  type: 'choice',
  schema: (spec) => ({ enum: (spec.options ?? []).map((o) => o.value) }),
  clean: (spec, value) => (typeof value === 'string' && (spec.options ?? []).some((o) => o.value === value) ? value : undefined)
})
