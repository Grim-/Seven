import { avatarRenderers, builtinAvatars } from '@shared/avatars'
import { cn } from '../../../lib/cn'
import { LiveAvatar } from '../LiveAvatar'

export function RendererPicker({ value, onChange }: { value: string; onChange: (renderer: string) => void }) {
  const samples = builtinAvatars()
  return (
    <div className="flex flex-wrap gap-1.5">
      {avatarRenderers().map((r) => {
        const sample = samples.find((a) => a.renderer === r.id)
        return (
          <button key={r.id} type="button" title={r.description} onClick={() => onChange(r.id)} className={cn('flex items-center gap-1.5 border px-2 py-0.5 text-[11.5px]', value === r.id ? 'border-accent bg-accent/10 text-white' : 'border-line text-dim hover:text-white')}>
            {sample && <LiveAvatar avatar={sample} size={20} />}
            {r.label}
          </button>
        )
      })}
    </div>
  )
}
