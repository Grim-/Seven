import { showName } from '@shared/ids'
import { plainText, splitLink } from '@shared/text'
import { ShellFace } from '../ui'
import { AssetMedia } from '../pictures/AssetMedia'
import { presentOf } from '../../registries/kinds'
import { useEntryPreview } from './entryPreview'

export function EntryFace({ link, compact = false }: { link: string; compact?: boolean }) {
  const preview = useEntryPreview(link)
  const { kind, ref } = splitLink(link)
  const label = (kind ?? '').toUpperCase()
  if (!preview) return <ShellFace title={showName(ref)} label={label} body="Loading…" />
  if ('missing' in preview) return <ShellFace title={showName(ref)} label={label} marks={['MISSING']} body={preview.missing} />
  const { Face, Thumb } = presentOf(preview.kind)
  if (Face && !compact) return <Face id={preview.id} />
  const art = preview.image ? <AssetMedia id={preview.image} className="h-full w-full" /> : Thumb ? <Thumb id={preview.id} large /> : undefined
  const rawBody = plainText(preview.card) || ''
  const cleanBody = rawBody
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, compact ? 3 : 5)
    .join('\n')
  return (
    <ShellFace
      title={showName(preview.title)}
      label={preview.label.toUpperCase()}
      art={art}
      body={cleanBody || undefined}
      className={compact ? 'h-[250px] max-h-[250px] overflow-hidden' : undefined}
    />
  )
}
