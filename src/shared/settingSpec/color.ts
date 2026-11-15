import { isThemeColor, registerSettingType } from './spec'

const HEX = /^#[0-9a-f]{6}$/i

registerSettingType({
  type: 'color',
  schema: (spec) => ({ type: 'string', description: spec.themed ? '#rrggbb, accent or secondary' : '#rrggbb' }),
  clean: (spec, value) => {
    if (typeof value !== 'string') return undefined
    if (HEX.test(value)) return value.toLowerCase()
    return spec.themed && isThemeColor(value) ? value : undefined
  }
})
