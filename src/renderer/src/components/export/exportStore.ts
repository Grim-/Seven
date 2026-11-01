import { create } from 'zustand'

interface ExportRequest {
  source: string
  args: Record<string, string>
}

export const useExport = create<{ request: ExportRequest | null }>(() => ({ request: null }))

export function openExport(source: string, args: Record<string, string> = {}): void {
  useExport.setState({ request: { source, args } })
}

export function closeExport(): void {
  useExport.setState({ request: null })
}
