import type { PictureOptions } from '../../data/PicturePicker'
import { PictureField } from '../../pictures/PictureField'
import { TunableRow } from '../../ui'
import { useData } from '../../../store/data'
import { formatBytes } from '../../../lib/format'

export function PictureTune({ label, value, options, onChange, hint }: { label: string; hint?: string; value: string | undefined; options: PictureOptions; onChange: (id: string | undefined) => void }) {
  const size = useData((s) => (value ? s.assets.find((a) => a.id === value)?.size : undefined))
  return (
    <TunableRow label={label} changed={value !== undefined} onReset={() => onChange(undefined)} hint={hint} wide>
      <span className="flex items-center gap-3">
        <PictureField value={value ?? null} options={options} onChange={(id) => onChange(id ?? undefined)} />
        {size !== undefined && <span className="font-data text-[11px] text-faint">{formatBytes(size)}</span>}
      </span>
    </TunableRow>
  )
}
