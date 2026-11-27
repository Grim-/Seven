import { useState, useMemo } from 'react'
import { Plus, X } from 'lucide-react'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { Select, Button, Input } from '../ui'
import { cn } from '../../lib/cn'

interface FlagSelectProps {
  world?: string
  value?: string
  onChange: (flag: string | undefined) => void
  placeholder?: string
  className?: string
}

export function FlagSelect({
  world,
  value,
  onChange,
  placeholder = 'Select world flag...',
  className
}: FlagSelectProps) {
  const flags = useLive(() => (world ? engine('worlds.flags', { id: world }) : Promise.resolve({})), 'worlds.changed') ?? {}
  const uses = useLive(() => (world ? engine('worlds.maps', { id: world }) : Promise.resolve([])), 'worlds.changed') ?? []

  const [isTypingNew, setIsTypingNew] = useState(false)
  const [newFlagText, setNewFlagText] = useState('')

  // Aggregate all known flags across world manifest and map uses
  const knownFlags = useMemo(() => {
    const set = new Set<string>(Object.keys(flags))
    for (const u of uses) {
      for (const t of u.triggers ?? []) {
        if (t.needsFlag) set.add(t.needsFlag)
        if (t.hiddenIfFlag) set.add(t.hiddenIfFlag)
        if (t.setsFlag) set.add(t.setsFlag)
      }
      for (const gating of Object.values(u.layerGating ?? {})) {
        if (gating.needsFlag) set.add(gating.needsFlag)
        if (gating.hiddenIfFlag) set.add(gating.hiddenIfFlag)
      }
      for (const gating of Object.values(u.propGating ?? {})) {
        if (gating.needsFlag) set.add(gating.needsFlag)
        if (gating.hiddenIfFlag) set.add(gating.hiddenIfFlag)
      }
    }
    return [...set].sort()
  }, [flags, uses])

  const handleSelect = (val: string) => {
    if (val === '__new__') {
      setIsTypingNew(true)
      setNewFlagText('')
    } else {
      onChange(val ? val : undefined)
    }
  }

  const handleConfirmNew = () => {
    const trimmed = newFlagText.trim().toLowerCase().replace(/\s+/g, '_')
    if (trimmed) {
      onChange(trimmed)
    }
    setIsTypingNew(false)
  }

  if (isTypingNew) {
    return (
      <div className={cn('flex items-center gap-1.5 font-ui w-full', className)}>
        <Input
          autoFocus
          value={newFlagText}
          onChange={(e) => setNewFlagText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleConfirmNew()
            } else if (e.key === 'Escape') {
              setIsTypingNew(false)
            }
          }}
          placeholder="Type new flag name..."
          className="h-8 min-w-0 flex-1 text-[11px]"
        />
        <Button
          size="sm"
          variant="primary"
          onClick={handleConfirmNew}
          className="h-8 px-2 text-[10px]"
        >
          OK
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon={<X className="h-3.5 w-3.5" />}
          onClick={() => setIsTypingNew(false)}
          className="h-8 px-1.5"
        />
      </div>
    )
  }

  const currentValue = value ?? ''
  const hasCustomValue = currentValue && !knownFlags.includes(currentValue)

  const options = [
    { value: '', label: placeholder },
    ...(hasCustomValue ? [{ value: currentValue, label: `${currentValue} (Current)` }] : []),
    ...knownFlags.map((flag) => ({ value: flag, label: flag })),
    { value: '__new__', label: '+ Define New Flag...' }
  ]

  return (
    <div className={cn('flex items-center gap-1.5 font-ui w-full', className)}>
      <Select
        value={currentValue}
        options={options}
        onChange={handleSelect}
        className="h-8 flex-1 text-[11.5px]"
      />
      <Button
        size="sm"
        variant="ghost"
        icon={<Plus className="h-3.5 w-3.5" />}
        title="Define a new world flag"
        onClick={() => setIsTypingNew(true)}
        className="h-8 w-8 shrink-0 p-0"
      />
    </div>
  )
}
