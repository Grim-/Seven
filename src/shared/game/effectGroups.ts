export interface EffectGroup {
  id: string
  label: string
  tone: string
  order: number
}

export const HARM: EffectGroup = { id: 'harm', label: 'Harm', tone: '#f97316', order: 0 }
export const HELP: EffectGroup = { id: 'help', label: 'Help', tone: '#34d399', order: 1 }
export const CONDITIONS: EffectGroup = { id: 'conditions', label: 'Conditions', tone: '#a855f7', order: 2 }
export const ITEMS: EffectGroup = { id: 'items', label: 'Items', tone: '#facc15', order: 3 }
export const LUCK: EffectGroup = { id: 'luck', label: 'Luck', tone: '#66fcf1', order: 4 }
export const WORLD: EffectGroup = { id: 'world', label: 'World', tone: '#60a5fa', order: 5 }
export const REUSE: EffectGroup = { id: 'reuse', label: 'Reuse', tone: '#e4e4e7', order: 6 }
