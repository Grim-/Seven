import { registerSettingType } from './spec'

registerSettingType({
  type: 'toggle',
  schema: () => ({ type: 'boolean' }),
  clean: (_spec, value) => (typeof value === 'boolean' ? value : undefined)
})
