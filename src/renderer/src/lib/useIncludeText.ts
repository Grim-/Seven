import { engine } from './ipc'
import { useLibraryData } from './useLive'

export function useIncludeText(kind: string, ref: string, part: string | null): string | null {
  return useLibraryData(() => (part ? engine('library.field', { entry: `@${kind}:${ref}`, field: part }) : Promise.resolve(null)), `include.${kind}:${ref}#${part ?? ''}`)
}
