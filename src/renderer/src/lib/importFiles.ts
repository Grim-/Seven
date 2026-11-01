import type { AssetMeta, LibraryImport } from '@shared/types'
import { engine, main } from './ipc'
import { failed } from './notify'
import { toast } from '../store/toasts'
import { checkCarried } from '../components/carry/carryStore'
import { showInData } from './library'

export function addPaths(paths: string[], parent: string | null = null): Promise<AssetMeta[]> {
  return engine('data.assets.import', { paths, parent }).catch((err) => {
    failed('Could not add the files')(err)
    return [] as AssetMeta[]
  })
}

export function importPaths(paths: string[], parent: string | null = null): Promise<AssetMeta[]> {
  return addPaths(paths, parent).then((added) => {
    checkCarried(added)
    return added
  })
}

export async function importToLibrary(paths: string[], parent: string | null = null): Promise<LibraryImport> {
  const result = await engine('data.import', { paths, parent }).catch((err) => {
    failed('Could not add the files')(err)
    return { files: [], pages: [], failed: [] } as LibraryImport
  })
  for (const f of result.failed) toast.error(`Could not add ${f.name}`, f.error)
  if (result.pages.length) toast.success(`Added ${result.pages.length} page${result.pages.length === 1 ? '' : 's'}`, `${result.pages.map((p) => p.title).join(', ')}: markdown files become pages you can edit.`, { label: 'Open', onSelect: () => showInData({ kind: 'page', id: result.pages[0].id }) })
  return result
}

export async function chooseFiles(parent: string | null = null): Promise<AssetMeta[]> {
  const paths = await main('dialog.openFiles')
  if (!paths.length) return []
  const { files } = await importToLibrary(paths, parent)
  checkCarried(files)
  return files
}

export function fitsFile(a: AssetMeta, kinds: AssetMeta['kind'][], mimes?: string[]): boolean {
  return kinds.includes(a.kind) && (!mimes || mimes.includes(a.mime))
}

export function onlyKinds(added: AssetMeta[], kinds: AssetMeta['kind'][], what: string, mimes?: string[]): AssetMeta[] {
  const fits = added.filter((a) => fitsFile(a, kinds, mimes))
  const rest = added.filter((a) => !fitsFile(a, kinds, mimes))
  if (rest.length) toast.error(`Not ${what}`, `${rest.map((a) => a.name).join(', ')} ${rest.length === 1 ? 'was' : 'were'} added to Files but not used here.`)
  return fits
}

export async function choosePictures(kinds: AssetMeta['kind'][], multiple: boolean, what: string, mimes?: string[]): Promise<AssetMeta[]> {
  const paths = await main('dialog.openFiles')
  if (!paths.length) return []
  return onlyKinds(await importPaths(multiple ? paths : paths.slice(0, 1)), kinds, what, mimes)
}
