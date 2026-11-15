import { cn } from '../../../../lib/cn'
import { registerEffectToken, type TokenEditProps, type TokenProps } from './registry'

function Text({ value }: TokenProps) {
  return <>{value === true ? 'Yes' : 'No'}</>
}

function Edit({ value, onChange, close }: TokenEditProps) {
  return (
    <div className="flex gap-1.5">
      {[true, false].map((v) => (
        <button
          key={String(v)}
          type="button"
          onClick={() => {
            onChange(v)
            close()
          }}
          className={cn('border px-3 py-1 font-mono text-[12px]', (value === true) === v ? 'border-accent bg-accent text-black' : 'border-line/60 text-dim hover:border-dim hover:text-white')}
        >
          {v ? 'Yes' : 'No'}
        </button>
      ))}
    </div>
  )
}

registerEffectToken('flag', { Text, Edit })
