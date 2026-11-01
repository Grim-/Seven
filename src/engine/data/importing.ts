import fs from 'node:fs'
import path from 'node:path'
import type { LibraryImport } from '@shared/types'
import { classify } from './assets'
import { data } from './hub'

const AS_PAGE = new Set(['text/markdown'])

export function importToLibrary(files: string[], parent: string | null): LibraryImport {
  const folder = data.pages.folderOf(parent)
  const out: LibraryImport = { files: [], pages: [], failed: [] }
  for (const file of files) {
    try {
      if (AS_PAGE.has(classify(file).mime)) {
        const page = data.pages.create({ title: path.parse(file).name, body: fs.readFileSync(file, 'utf8'), ...(folder ? { parent: folder } : {}) })
        out.pages.push({ id: page.id, title: page.title })
      } else {
        const added = data.assets.register(file, { tool: null, sessionId: null, original: file })
        out.files.push(folder ? data.assets.move(added.id, folder) : added)
      }
    } catch (err) {
      out.failed.push({ name: path.basename(file), error: err instanceof Error ? err.message : String(err) })
    }
  }
  return out
}
