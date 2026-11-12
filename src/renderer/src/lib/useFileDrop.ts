import { useEffect, useState } from 'react'
import { filePath, hasCapability, sendFile } from './transport'

export interface DroppedFile {
  path: string
  file: File
}

export function useFileDrop(onPaths: (paths: string[], e: React.DragEvent, dropped: DroppedFile[]) => void, enabled = true) {
  const [over, setOver] = useState(false)
  useEffect(() => {
    if (!over) return
    const clear = () => setOver(false)
    const left = (e: DragEvent) => {
      if (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) clear()
    }
    window.addEventListener('drop', clear, true)
    window.addEventListener('dragleave', left, true)
    return () => {
      window.removeEventListener('drop', clear, true)
      window.removeEventListener('dragleave', left, true)
    }
  }, [over])
  const has = (e: React.DragEvent) => enabled && Array.from(e.dataTransfer.types).includes('Files')
  const props = {
    onDragOver: (e: React.DragEvent) => {
      if (!has(e)) return
      e.preventDefault()
      e.stopPropagation()
      setOver(true)
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false)
    },
    onDrop: (e: React.DragEvent) => {
      if (!has(e)) return
      e.preventDefault()
      e.stopPropagation()
      setOver(false)
      const files = Array.from(e.dataTransfer.files)
      const dropped = files.map((file) => ({ path: filePath(file), file })).filter((d) => d.path)
      if (dropped.length) return onPaths(dropped.map((d) => d.path), e, dropped)
      if (!files.length || !hasCapability('sendFile')) return
      void Promise.all(files.map(async (file) => ({ path: await sendFile(file), file })))
        .then((sent) => onPaths(sent.map((d) => d.path), e, sent))
        .catch(() => undefined)
    }
  }
  return { over, props }
}
