export interface BlueprintRow {
  id: string
  name: string
  facts: { label: string; value: string }[]
}

export interface BlueprintSource {
  id: string
  label: string
}
