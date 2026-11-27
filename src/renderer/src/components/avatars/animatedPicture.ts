import { main } from '../../lib/ipc'

interface DecodedFrame {
  image: CanvasImageSource & { displayWidth: number; displayHeight: number; duration: number | null; close(): void }
}

interface Decoder {
  tracks: { ready: Promise<void>; selectedTrack: { frameCount: number } | null }
  decode(options: { frameIndex: number }): Promise<DecodedFrame>
  close(): void
}

interface DecoderClass {
  new (init: { data: BufferSource; type: string }): Decoder
  isTypeSupported(type: string): Promise<boolean>
}

const MIN_FRAME_MS = 20
const DEFAULT_FRAME_MS = 100

export class AnimatedPicture {
  constructor(
    private readonly frames: ImageBitmap[],
    private readonly ends: number[],
    readonly width: number,
    readonly height: number
  ) {}

  get length(): number {
    return this.ends[this.ends.length - 1]
  }

  frameAt(ms: number, loop: boolean): ImageBitmap {
    const t = loop ? ms % this.length : Math.min(ms, this.length - 1)
    const i = this.ends.findIndex((end) => t < end)
    return this.frames[i < 0 ? this.frames.length - 1 : i]
  }
}

export async function decodeAnimated(id: string): Promise<AnimatedPicture | null> {
  const Decoder = (globalThis as { ImageDecoder?: DecoderClass }).ImageDecoder
  if (!Decoder) return null
  const found = await main('assets.readImage', { id })
  if (!found || !(await Decoder.isTypeSupported(found.mime))) return null
  const decoder = new Decoder({ data: found.bytes, type: found.mime })
  try {
    await decoder.tracks.ready
    const count = decoder.tracks.selectedTrack?.frameCount ?? 1
    if (count < 2) return null
    const frames: ImageBitmap[] = []
    const ends: number[] = []
    let at = 0
    let size: [number, number] = [0, 0]
    for (let i = 0; i < count; i++) {
      const { image } = await decoder.decode({ frameIndex: i })
      size = [image.displayWidth, image.displayHeight]
      frames.push(await createImageBitmap(image))
      at += Math.max(MIN_FRAME_MS, image.duration ? image.duration / 1000 : DEFAULT_FRAME_MS)
      ends.push(at)
      image.close()
    }
    return new AnimatedPicture(frames, ends, size[0], size[1])
  } finally {
    decoder.close()
  }
}
