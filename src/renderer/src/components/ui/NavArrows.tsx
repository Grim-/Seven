import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Button } from './Button'

export function NavArrows({ back, forward }: { back: (() => void) | null; forward: (() => void) | null }) {
  return (
    <>
      <Button size="sm" variant="ghost" icon={<ArrowLeft />} title="Back" disabled={!back} onClick={() => back?.()} />
      <Button size="sm" variant="ghost" icon={<ArrowRight />} title="Forward" disabled={!forward} onClick={() => forward?.()} />
    </>
  )
}
