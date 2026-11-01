import { showName } from '@shared/ids'
import { plainText, splitLink } from '@shared/text'
import { ShellFace } from '../ui'
import { AssetMedia } from '../pictures/AssetMedia'
import { presentOf } from '../../registries/kinds'
import { useEntryPreview } from './entryPreview'

export function EntryFace({ link }: { link: string }) {
  const preview = useEntryPreview(link)
  const { kind, ref } = splitLink(link)
  const label = (kind ?? '').toUpperCase()
  if (!preview) return <ShellFace title={showName(ref)} label={label} body="Loading…" />
  if ('missing' in preview) return <ShellFace title={showName(ref)} label={label} marks={['MISSING']} body={preview.missing} />
  const { Face, Thumb } = presentOf(preview.kind)
  if (Face) return <Face id={preview.id} />
  const art = preview.image ? <AssetMedia id={preview.image} className="h-full w-full" /> : Thumb ? <Thumb id={preview.id} large /> : undefined
  return <ShellFace title={showName(preview.title)} label={preview.label.toUpperCase()} art={art} body={plainText(preview.card) || undefined} />
}
