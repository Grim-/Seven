import { Shop } from '../Shop'
import { registerTriggerUi, type TriggerPanelProps } from './registry'

function ShopPanel({ trigger, ctx }: TriggerPanelProps) {
  const v = trigger.values
  return <Shop visitor={ctx.party.find((p) => p.sheet === ctx.sheet) ?? null} catalog={ctx.catalog} stock={Array.isArray(v.stock) ? (v.stock as string[]) : []} buyRate={Number(v.buyRate)} sellRate={Number(v.sellRate)} text={String(v.text ?? '')} />
}

registerTriggerUi('shop', { Panel: ShopPanel, wide: true })
