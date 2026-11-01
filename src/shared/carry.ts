export type CarrySource = { asset: string } | { path: string }

export interface CarryAbout {
  kind: string | null
  label: string
  title: string
  also: string[]
}

export interface CarrySummary {
  source: CarrySource
  savedAt: number
  locked: boolean
  about: CarryAbout | null
  exists: boolean
}

export type CarryMode = 'copy' | 'replace'

export interface CarryOpened {
  entry: { kind: string; id: string } | null
  text: string | null
}
