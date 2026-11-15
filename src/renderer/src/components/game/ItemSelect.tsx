import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { ITEM_TEMPLATES } from '@shared/game/defs'
import { useGameDefs } from './useGameDefs'
import { Select, Button, Input } from '../ui'
import { cn } from '../../lib/cn'

interface ItemSelectProps {
  value?: string
  onChange: (item: string | undefined) => void
  placeholder?: string
  className?: string
}

export function ItemSelect({
  value,
  onChange,
  placeholder = 'Select inventory item...',
  className
}: ItemSelectProps) {
  const defs = useGameDefs(ITEM_TEMPLATES)
  const items = defs.list ?? []

  const [isTypingCustom, setIsTypingCustom] = useState(false)
  const [customText, setCustomText] = useState('')

  const handleSelect = (val: string) => {
    if (val === '__custom__') {
      setIsTypingCustom(true)
      setCustomText('')
    } else {
      onChange(val ? val : undefined)
    }
  }

  const handleConfirmCustom = () => {
    const trimmed = customText.trim().toLowerCase().replace(/\s+/g, '_')
    if (trimmed) {
      onChange(trimmed)
    }
    setIsTypingCustom(false)
  }

  if (isTypingCustom) {
    return (
      <div className={cn('flex items-center gap-1.5 font-mono w-full', className)}>
        <Input
          autoFocus
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleConfirmCustom()
            } else if (e.key === 'Escape') {
              setIsTypingCustom(false)
            }
          }}
          placeholder="Type custom item ID..."
          className="h-8 min-w-0 flex-1 text-[11px]"
        />
        <Button
          size="sm"
          variant="primary"
          onClick={handleConfirmCustom}
          className="h-8 px-2 text-[10px]"
        >
          OK
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon={<X className="h-3.5 w-3.5" />}
          onClick={() => setIsTypingCustom(false)}
          className="h-8 px-1.5"
        />
      </div>
    )
  }

  const currentValue = value ?? ''
  const hasCustomValue = currentValue && !items.some((item) => item.id === currentValue)

  const options = [
    { value: '', label: placeholder },
    ...(hasCustomValue ? [{ value: currentValue, label: `${currentValue} (Custom)` }] : []),
    ...items.map((item) => ({ value: item.id, label: `${item.name} (${item.id})` })),
    { value: '__custom__', label: '+ Enter Custom Item ID...' }
  ]

  return (
    <div className={cn('flex items-center gap-1.5 font-mono w-full', className)}>
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
        title="Enter custom item ID"
        onClick={() => setIsTypingCustom(true)}
        className="h-8 w-8 shrink-0 p-0"
      />
    </div>
  )
}
