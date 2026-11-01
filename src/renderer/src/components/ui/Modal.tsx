import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '../../lib/cn'
import { useEscapeLayer } from '../../lib/escape'

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  footer?: ReactNode
  wide?: boolean
  bodyClassName?: string
  children: ReactNode
}

export function Modal({ open, title, onClose, footer, wide, bodyClassName, children }: ModalProps) {
  const layer = useEscapeLayer(open, onClose)

  return (
    <AnimatePresence>
    {open && (
    <motion.div
      data-layer
      className="fixed inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      style={{ zIndex: 100 + layer }}
      onMouseDown={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <motion.div
        className={cn('record', wide ? 'flex max-h-[92vh] w-[min(1240px,96vw)] flex-col' : 'w-[min(520px,92vw)]')}
        onMouseDown={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 4 }}
        transition={{ type: 'spring', stiffness: 520, damping: 34, mass: 0.6 }}
      >
        <div className="record-header flex items-center justify-between">
          <span>{title}</span>
          <button className="text-dim hover:text-alert" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className={cn('relative z-[2] font-sans text-[13.5px] text-white', bodyClassName ?? 'p-4')}>{children}</div>
        {footer && <div className="relative z-[2] flex justify-end gap-2 border-t border-line/60 px-4 py-3">{footer}</div>}
      </motion.div>
    </motion.div>
    )}
    </AnimatePresence>
  )
}
