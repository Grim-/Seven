import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../lib/cn'

type Slots = { lead: HTMLElement | null; tools: HTMLElement | null }

const AddressSlots = createContext<Slots | null>(null)

export function useAddressPane(): boolean {
  return useContext(AddressSlots) !== null
}

export function AddressPane({ path, tools, className, children }: { path: ReactNode; tools?: ReactNode; className?: string; children: ReactNode }) {
  const [lead, setLead] = useState<HTMLElement | null>(null)
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  const slots = useMemo(() => ({ lead, tools: slot }), [lead, slot])
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <div className="flex min-h-11 shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-line/40 bg-sidebar/80 px-2 py-1.5">
        <div ref={setLead} className="flex items-center gap-0.5 empty:hidden" />
        <div className="flex min-w-0 flex-1 basis-40 items-center gap-2">{path}</div>
        <div ref={setSlot} className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 empty:hidden" />
        {tools && <div className="flex items-center gap-1.5">{tools}</div>}
      </div>
      <AddressSlots.Provider value={slots}>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </AddressSlots.Provider>
    </div>
  )
}

function Slotted({ to, order, children }: { to: keyof Slots; order: number; children: ReactNode }) {
  const slots = useContext(AddressSlots)
  if (!slots) return <>{children}</>
  const target = slots[to]
  return target ? createPortal(<div style={{ order }} className="flex items-center gap-1.5">{children}</div>, target) : null
}

export function AddressLead({ order = 0, children }: { order?: number; children: ReactNode }) {
  return (
    <Slotted to="lead" order={order}>
      {children}
    </Slotted>
  )
}

export function AddressTools({ order = 0, children }: { order?: number; children: ReactNode }) {
  return (
    <Slotted to="tools" order={order}>
      {children}
    </Slotted>
  )
}
