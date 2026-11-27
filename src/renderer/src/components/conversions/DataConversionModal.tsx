import { AlertTriangle, Archive, ArrowRight, Check, ShieldAlert } from 'lucide-react'
import { cn } from '../../lib/cn'
import { useConversions } from '../../store/conversions'
import { AlertBox, Button, Eyebrow, Modal } from '../ui'

export function DataConversionHost() {
  const { pending, choices, open, busy, error, lastBackupPath, setChoice, setAllChoices, dismiss, backupAndRun, runWithoutBackup } =
    useConversions()

  if (!open || !pending.length) return null

  const blocking = pending.some((p) => p.blocking)
  const anyEncrypted = pending.some((p) => p.vaultEncrypted)
  const missingRequired = pending.some((item) =>
    item.decisions?.some((d) => d.required && !(choices[item.id]?.[d.key]?.length))
  )
  const title = pending.length === 1 ? pending[0].title : `Update Stored Data (${pending.length})`

  return (
    <Modal
      open
      title={title}
      wide={pending.some((p) => Boolean(p.decisions?.length))}
      onClose={blocking || busy ? () => undefined : dismiss}
      bodyClassName="flex flex-col gap-3.5 p-4 font-ui"
    >
      <p className="text-[12.5px] leading-relaxed text-dim">
        Seven found stored data from an earlier format. Review what will change below — you can save a{' '}
        <span className="font-mono text-[11.5px] text-ink">.zip</span> backup of the affected files to a location of
        your choice right before converting.
      </p>

      <div className="flex max-h-[55vh] flex-col gap-2.5 overflow-y-auto">
        {pending.map((item) => {
          const itemChoices = choices[item.id] ?? {}
          const options = item.options ?? []
          const decisions = item.decisions ?? []
          return (
            <div key={item.id} className="flex flex-col gap-2.5 border border-line/50 tone-panel-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold text-ink">{item.title}</span>
                <Eyebrow className="text-accent">{item.domain}</Eyebrow>
              </div>
              <p className="text-[11.5px] leading-relaxed text-dim">{item.description}</p>
              {item.affects.length > 0 && (
                <ul className="flex flex-col gap-1 border-t border-line/30 pt-2 text-[11px] text-ink">
                  {item.affects.map((line) => (
                    <li key={line} className="flex items-start gap-1.5">
                      <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-accent" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              )}

              {decisions.length > 0 && (
                <div className="flex flex-col gap-2 border-t border-line/30 pt-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Eyebrow className="text-secondary-ink">Choose destinations</Eyebrow>
                    {decisions.length > 1 && options.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 text-[10px]">
                        <span className="text-faint">All:</span>
                        {options.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setAllChoices(item.id, [opt.value])}
                            className="border border-line/50 tone-well-60 px-1.5 py-0.5 text-dim hover:border-accent hover:text-ink"
                          >
                            {opt.label}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setAllChoices(item.id, [])}
                          className="border border-line/40 px-1.5 py-0.5 text-faint hover:text-alert"
                        >
                          Skip all
                        </button>
                      </div>
                    )}
                  </div>

                  {options.length === 0 ? (
                    <div className="border border-warn/40 tone-well-60 px-2.5 py-2 text-[11px] text-warn">
                      No worlds exist yet. Create a world first, or leave unchecked to skip (saved in your backup zip).
                    </div>
                  ) : (
                    <div className="flex flex-col divide-y divide-line/30 border border-line/40 tone-well-40">
                      {decisions.map((d) => {
                        const selected = itemChoices[d.key] ?? []
                        const droppedRef = d.defaultSelected.some((def) => !selected.includes(def))
                        const toggle = (val: string) => {
                          if (d.multi) {
                            const next = selected.includes(val)
                              ? selected.filter((x) => x !== val)
                              : [...selected, val]
                            setChoice(item.id, d.key, next)
                          } else {
                            setChoice(item.id, d.key, selected.includes(val) ? [] : [val])
                          }
                        }
                        return (
                          <div key={d.key} className="flex flex-col gap-1.5 px-2.5 py-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-[12px] font-semibold text-ink">{d.label}</span>
                                  {d.detail && <span className="text-[10.5px] text-faint">{d.detail}</span>}
                                </div>
                                {d.hint && <div className="text-[10.5px] text-dim">{d.hint}</div>}
                              </div>

                              <div className="flex flex-wrap items-center gap-1">
                                {options.map((opt) => {
                                  const on = selected.includes(opt.value)
                                  return (
                                    <button
                                      key={opt.value}
                                      type="button"
                                      onClick={() => toggle(opt.value)}
                                      className={cn(
                                        'inline-flex items-center gap-1 border px-2 py-0.5 text-[11px] transition-colors',
                                        on
                                          ? 'border-accent bg-accent/15 font-semibold text-ink'
                                          : 'border-line/50 text-dim hover:border-line hover:text-ink'
                                      )}
                                    >
                                      {on && <Check className="h-3 w-3 text-accent" />}
                                      <span>{opt.label}</span>
                                    </button>
                                  )
                                })}
                                {!d.required && selected.length === 0 && (
                                  <span className="px-1.5 text-[10px] text-faint">Skipped</span>
                                )}
                              </div>
                            </div>
                            {droppedRef && (
                              <div className="flex items-center gap-1 text-[10.5px] text-warn">
                                <AlertTriangle className="h-3 w-3 shrink-0" />
                                <span>Unchecked a world where this item is currently referenced.</span>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {anyEncrypted && (
        <div className="flex items-start gap-2 border border-warn/40 tone-well-60 px-3 py-2 text-[11px] text-warn">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Your vault is encrypted. A saved <span className="font-mono">.zip</span> backup exports plain JSON on disk
            so you can inspect or restore it — store it somewhere private.
          </span>
        </div>
      )}

      {lastBackupPath && (
        <div className="border border-ok/40 tone-well-60 px-3 py-1.5 text-[11px] text-ok">
          Backup written to <span className="font-mono">{lastBackupPath}</span>
        </div>
      )}

      {error && <AlertBox>{error}</AlertBox>}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line/40 pt-3">
        {!blocking && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={dismiss}>
            Later
          </Button>
        )}
        <Button
          size="sm"
          variant="secondary"
          disabled={busy || missingRequired}
          onClick={() => void runWithoutBackup()}
        >
          Convert Without Backup
        </Button>
        <Button
          size="sm"
          variant="primary"
          icon={<Archive className="h-3.5 w-3.5" />}
          disabled={busy || missingRequired}
          onClick={() => void backupAndRun()}
        >
          {busy ? 'Converting…' : 'Save Backup & Convert…'}
        </Button>
      </div>
    </Modal>
  )
}
