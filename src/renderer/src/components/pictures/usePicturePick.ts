import { pickPicture, type PictureOptions } from '../data/PicturePicker'
import { choosePictures } from '../../lib/importFiles'
import { generateImage } from './GenerateImageModal'

export function usePicturePick(value: string | null, onChange: (id: string | null) => void, options: PictureOptions = {}) {
  const fromSeven = () => void pickPicture(value, options).then((r) => r && onChange(r.id))
  const fromDisk = async () => {
    const [added] = await choosePictures(options.kinds ?? ['image'], false, options.what ?? 'a picture', options.mimes)
    if (added) onChange(added.id)
  }
  const fromGenerate = async () => {
    const asset = await generateImage({
      title: options.what ? `Generate ${options.what}` : 'Generate Image',
      sourceAssetId: value ?? undefined,
      context: options.context
    })
    if (asset) onChange(asset.id)
  }
  return { fromSeven, fromDisk: () => void fromDisk(), fromGenerate: () => void fromGenerate() }
}
