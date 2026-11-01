import { useEffect } from 'react'
import { importMapFile } from './importMapFile'
import { failed } from '../../lib/notify'
import { openEntry } from '../../lib/library'
import { toast } from '../../store/toasts'

export function MapImporter({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    void importMapFile(null)
      .then((made) => made && toast.success(`Imported ${made.name}`, undefined, { label: 'Open', onSelect: () => openEntry('map', made.id) }))
      .catch(failed('Could not import the map'))
      .finally(onClose)
  }, [])
  return null
}
