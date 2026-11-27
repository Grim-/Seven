export interface ConversionOption {
  value: string
  label: string
}

export interface ConversionDecision {
  key: string
  label: string
  detail?: string
  hint?: string
  multi?: boolean
  required?: boolean
  defaultSelected: string[]
}

export type ConversionChoices = Record<string, Record<string, string[]>>

export interface PendingConversion {
  id: string
  domain: string
  title: string
  description: string
  affects: string[]
  options?: ConversionOption[]
  decisions?: ConversionDecision[]
  blocking?: boolean
  vaultEncrypted: boolean
}

export interface ConversionBackupResult {
  path: string
  files: number
  bytes: number
}

export interface ConversionRunResult {
  completed: string[]
  summary: string[]
}
