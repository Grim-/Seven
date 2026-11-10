import { useState } from 'react'
import { Plus, Pencil, Check } from 'lucide-react'
import { useLive } from '../../lib/useLive'
import { engine } from '../../lib/ipc'
import {
  blankStoredTriggerAction,
  STARTER_TRIGGER_ACTIONS,
  type StoredTriggerAction
} from '@shared/game/triggerActions'
import { Button, Modal, Select } from '../ui'
import { TriggerActionEditor } from '../triggerActions/TriggerActionEditor'
import { cn } from '../../lib/cn'

interface TriggerActionSelectProps {
  value?: string | null
  onChange: (actionId: string | null) => void
  placeholder?: string
  className?: string
  inlineButtonLabel?: string
  hideInlineButton?: boolean
}

export function TriggerActionSelect({
  value,
  onChange,
  placeholder = 'None (no in-game trigger action)',
  className,
  inlineButtonLabel = '+ Action',
  hideInlineButton = false
}: TriggerActionSelectProps) {
  const liveActions = useLive(() => engine('triggerActions.list'), 'triggerActions.changed')
  const actions: StoredTriggerAction[] =
    liveActions && liveActions.length > 0 ? liveActions : STARTER_TRIGGER_ACTIONS

  const [modalOpen, setModalOpen] = useState(false)
  const [editingAction, setEditingAction] = useState<StoredTriggerAction>(blankStoredTriggerAction())
  const [isNew, setIsNew] = useState(true)

  const handleOpenCreate = () => {
    const blank = blankStoredTriggerAction()
    blank.name = 'New In-Game Action'
    blank.actionType = 'give_item'
    setEditingAction(blank)
    setIsNew(true)
    setModalOpen(true)
  }

  const handleOpenEdit = async () => {
    if (!value) return
    const existing = actions.find((a) => a.id === value)
    if (existing) {
      setEditingAction({ ...existing })
      setIsNew(false)
      setModalOpen(true)
    } else {
      const fetched = await engine('triggerActions.get', { id: value }).catch(() => null)
      if (fetched) {
        setEditingAction({ ...fetched })
        setIsNew(false)
        setModalOpen(true)
      }
    }
  }

  const handleSaveAndSelect = async () => {
    const toSave: StoredTriggerAction = {
      ...editingAction,
      name: editingAction.name.trim() || 'New In-Game Action'
    }
    const saved = await engine('triggerActions.save', {
      action: toSave,
      previousId: isNew ? null : editingAction.id
    })
    onChange(saved.id)
    setModalOpen(false)
  }

  const handleSelect = (next: string) => {
    if (next === '__NEW__') {
      handleOpenCreate()
      return
    }
    onChange(next ? next : null)
  }

  const options = [
    { value: '', label: placeholder },
    { value: '__NEW__', label: '+ Create new in-game action...' },
    ...actions.map((a) => ({
      value: a.id,
      label: `${a.name} [${a.actionType}]`
    }))
  ]

  return (
    <>
      <div className={cn('flex items-center gap-1.5 w-full', className)}>
        <div className="flex-1 min-w-0 h-full">
          <Select
            value={value ?? ''}
            options={options}
            onChange={handleSelect}
            className="h-full w-full text-inherit"
          />
        </div>

        {!hideInlineButton && (
          <div className="flex items-center gap-1 shrink-0 h-full">
            {value && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleOpenEdit}
                title="Edit this in-game action inline"
                className="h-full px-2 text-dim hover:text-cyan border border-line/40 shrink-0"
                icon={<Pencil className="h-3 w-3" />}
              />
            )}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={handleOpenCreate}
              title="Create new in-game trigger action inline"
              className="h-full px-2 text-[11px] font-bold text-cyan border border-cyan/40 hover:bg-cyan/10 shrink-0"
              icon={<Plus className="h-3 w-3 text-cyan" />}
            >
              {inlineButtonLabel}
            </Button>
          </div>
        )}
      </div>

      {modalOpen && (
        <Modal
          open={modalOpen}
          title={isNew ? 'Create In-Game Trigger Action' : `Edit Trigger Action: ${editingAction.name}`}
          onClose={() => setModalOpen(false)}
          wide
          footer={
            <div className="flex items-center justify-between w-full font-mono text-[11px]">
              <span className="text-dim">
                Will be saved to in-game actions and immediately selected in the dropdown.
              </span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleSaveAndSelect}
                  disabled={!editingAction.name.trim()}
                  icon={<Check className="h-3.5 w-3.5" />}
                >
                  Save &amp; Select Action
                </Button>
              </div>
            </div>
          }
        >
          <div className="p-3">
            <TriggerActionEditor value={editingAction} onChange={setEditingAction} />
          </div>
        </Modal>
      )}
    </>
  )
}
