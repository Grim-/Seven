import { useEffect, useState } from 'react'
import { Button, Field, FileField } from '../../ui'
import { engine } from '../../../lib/ipc'
import { formatBytes } from '../../../lib/format'

export function FolderStep({ root, defaultRoot, onRoot }: { root: string; defaultRoot: string; onRoot: (root: string) => void }) {
  const [free, setFree] = useState<number | null>(null)
  useEffect(() => {
    let live = true
    engine('install.space', { folder: root })
      .then((r) => live && setFree(r.free))
      .catch(() => live && setFree(null))
    return () => {
      live = false
    }
  }, [root])
  return (
    <div className="flex flex-col gap-3">
      <Field label="Install into" hint="Each version gets its own folder inside this one." group>
        <FileField folder value={root} onChange={onRoot} />
      </Field>
      <div className="flex items-center gap-3 text-[12.5px] text-dim">
        <span>Free on that drive: {free === null ? 'unknown' : formatBytes(free)}</span>
        {root !== defaultRoot && (
          <Button size="sm" variant="ghost" onClick={() => onRoot(defaultRoot)}>
            Use Seven's runtime folder
          </Button>
        )}
      </div>
    </div>
  )
}
