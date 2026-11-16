import { usePortability } from './portabilityStore'
import { PortableExportModal } from './PortableExportModal'
import { ImportModal } from './ImportModal'

export function PortabilityHost() {
  const exporting = usePortability((s) => s.exporting)
  const arrival = usePortability((s) => s.arrived[0])
  return (
    <>
      {exporting && <PortableExportModal state={exporting} />}
      {arrival && <ImportModal key={arrival.id} arrival={arrival} />}
    </>
  )
}
