import { pickPicture, type PictureOptions } from '../data/PicturePicker'
import { choosePictures } from '../../lib/importFiles'

export function usePicturePick(value: string | null, onChange: (id: string | null) => void, options: PictureOptions = {}) {
  const fromSeven = () => void pickPicture(value, options).then((r) => r && onChange(r.id))
  const fromDisk = async () => {
    const [added] = await choosePictures(options.kinds ?? ['image'], false, options.what ?? 'a picture', options.mimes)
    if (added) onChange(added.id)
  }
  return { fromSeven, fromDisk: () => void fromDisk() }
}
