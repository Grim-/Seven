export interface LaterAnswer {
  later: true
}

export const LATER: LaterAnswer = { later: true }

export function isLater(value: unknown): value is LaterAnswer {
  return Boolean(value && typeof value === 'object' && (value as Record<string, unknown>).later === true)
}

export function laterDecisionText(tool: 'decide' | 'roll_decision' | 'opposed_check', question: string, from: string | null): string {
  return `The player chose to come back to this decision later: "${question}"${from ? ` (${from})` : ''}. Carry on; ask again with ${tool} when they return to it.`
}
