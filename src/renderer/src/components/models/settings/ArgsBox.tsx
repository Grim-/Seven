import { useEffect, useState } from 'react'
import type { ModelConfig, ParamDef } from '@shared/types'
import { applyModelArgs, modelArgsText } from '@shared/modelArgs'
import { Input, SettingRow } from '../../ui'

export function ArgsBox({ config, params, onChange }: { config: ModelConfig; params: ParamDef[]; onChange: (c: ModelConfig) => void }) {
  const current = modelArgsText(config, params)
  const [text, setText] = useState(current)
  const [editing, setEditing] = useState(false)
  const [unknown, setUnknown] = useState<string[]>([])
  useEffect(() => {
    if (!editing) setText(current)
  }, [current, editing])
  const apply = () => {
    setEditing(false)
    const result = applyModelArgs(config, text, params)
    setUnknown(result.unknown)
    onChange(result.config)
  }
  return (
    <SettingRow wide label="llama.cpp options" hint="This model's settings as llama.cpp command-line flags, e.g. -ngl 99 -c 16384 -fa on --temp 0.6. Paste a line from a model card and press Enter: the flags Seven can use fill in its settings, flags it can't are listed underneath. Removing a flag puts that setting back to its default.">
      <div className="flex w-full flex-col gap-1">
        <Input
          value={text}
          onFocus={() => setEditing(true)}
          onChange={(e) => setText(e.target.value)}
          onBlur={apply}
          onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
          placeholder="-ngl 99 -c 16384 -fa on --temp 0.6"
          spellCheck={false}
          className="h-8 font-mono text-[12px]"
        />
        {unknown.length > 0 && <span className="font-mono text-[11px] text-alert">Not supported here: {unknown.join('  ')}</span>}
      </div>
    </SettingRow>
  )
}

