import { isAssetId } from '../ids'
import { registerSettingType } from './spec'

registerSettingType({
  type: 'picture',
  schema: () => ({ type: 'string', description: 'File id of a picture, GIF or video' }),
  clean: (_spec, value) => (value === '' || isAssetId(value) ? (value as string) : undefined)
})
