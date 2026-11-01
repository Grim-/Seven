import path from 'node:path'
import type { MapData } from '@shared/maps'
import { MapError } from './store'

export type MapContent = Pick<MapData, 'size' | 'tile' | 'tilesets' | 'layers'>

export interface MapReader {
  label: string
  extensions: string[]
  read(file: string, store: (file: string) => string): MapContent
}

const readers: MapReader[] = []

export function registerMapReader(reader: MapReader): void {
  readers.push(reader)
}

export function mapReaders(): { label: string; extensions: string[] }[] {
  return readers.map(({ label, extensions }) => ({ label, extensions }))
}

export function readerFor(file: string): MapReader {
  const ext = path.extname(file).slice(1).toLowerCase()
  const reader = readers.find((r) => r.extensions.includes(ext))
  if (!reader) throw new MapError(`Seven can import maps from ${readers.map((r) => `${r.label} (${r.extensions.map((e) => `.${e}`).join(', ')})`).join(', ')}. ${path.basename(file)} isn't one of them.`)
  return reader
}
