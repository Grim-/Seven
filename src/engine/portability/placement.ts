import { ASSET_IDS_IN, idSegment } from '@shared/ids'
import { IMPORT_TARGET, cleanFolderPath } from '@shared/saveFolders'
import { sanitizeFileName } from '@shared/portability'
import { data } from '../data/hub'
import { placeAnswer } from '../data/placement'
import { registerPlaceTarget } from '../data/placeTargets'
import { freeName } from '../library/packing'

registerPlaceTarget({ target: IMPORT_TARGET, label: 'Imports', home: 'Imports', asks: false })

export function usersOf(fileId: string, values: unknown[]): number[] {
  return values.flatMap((v, i) => (((JSON.stringify(v) ?? '').match(ASSET_IDS_IN) ?? ([] as string[])).includes(fileId) ? [i] : []))
}

export function folderName(text: string): string {
  return sanitizeFileName(text.replace(/\//g, '-'), 'entry')
}

export class ImportPlace {
  private ids = new Map<string, string | null>()
  private name: string | null = null
  private root: string

  constructor(
    root: string | null | undefined,
    private title: string
  ) {
    this.root = cleanFolderPath(root ?? placeAnswer(IMPORT_TARGET).folder)
  }

  private base(): string {
    if (this.name === null) {
      const rootId = this.root ? data.pages.makeFolders(this.root) : null
      this.name = freeName(idSegment(this.title) || 'import', (t) => Boolean(data.pages.taken(t, rootId)), (n, i) => `${n}_${i}`)
    }
    return this.root ? `${this.root}/${this.name}` : this.name
  }

  folder(sub = ''): string | null {
    const at = sub ? `${this.base()}/${sub}` : this.base()
    if (!this.ids.has(at)) this.ids.set(at, data.pages.makeFolders(at))
    return this.ids.get(at) ?? null
  }

  made(): string | null {
    return this.name === null ? null : this.folder()
  }
}
