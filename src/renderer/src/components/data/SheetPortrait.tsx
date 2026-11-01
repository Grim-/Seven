import { UserRound } from 'lucide-react'
import { cn } from '../../lib/cn'
import { AssetMedia } from '../pictures/AssetMedia'

export function SheetPortrait({ image, className }: { image: string | null; className?: string }) {
  return (
    <span className={cn('block shrink-0 overflow-hidden border border-line-strong bg-black/60', className)}>
      {image ? (
        <AssetMedia id={image} className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-faint">
          <UserRound className="h-1/2 w-1/2" />
        </span>
      )}
    </span>
  )
}
