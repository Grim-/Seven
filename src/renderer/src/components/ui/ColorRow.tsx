const PRESETS = ['#ffc919', '#22d3ee', '#a855f7', '#34d399', '#f472b6', '#ef4444', '#60a5fa', '#f97316']

export function ColorRow({ value, onChange, allowNone = false }: { value: string | null; onChange: (v: string | null) => void; allowNone?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {allowNone && (
        <button onClick={() => onChange(null)} title="Default" className={`h-6 border px-1.5 font-mono text-[10px] uppercase ${value === null ? 'border-white text-white' : 'border-line text-dim'}`}>
          Default
        </button>
      )}
      {PRESETS.map((c) => (
        <button key={c} onClick={() => onChange(c)} title={c} className={`h-6 w-6 border ${value === c ? 'border-white' : 'border-black'}`} style={{ background: c }} />
      ))}
      <input type="color" value={value ?? '#ffc919'} onChange={(e) => onChange(e.target.value)} className="h-6 w-8 cursor-pointer border border-line bg-transparent" title="Pick any colour" />
    </div>
  )
}
