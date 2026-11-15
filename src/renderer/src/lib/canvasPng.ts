export function canvasPngBase64(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('Could not draw the picture'))
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result).slice(String(reader.result).indexOf(',') + 1))
      reader.onerror = () => reject(reader.error ?? new Error('Could not read the picture'))
      reader.readAsDataURL(blob)
    }, 'image/png')
  )
}
