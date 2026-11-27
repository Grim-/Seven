export const beginPrompt = (title: string): string =>
  `Play out the confrontation for "${title}" between the participating figureheads based on their faction tensions and motivations. Stop before deciding who wins.`

export const CONTINUE_PROMPT = 'Continue.'

export const aftermathPrompt = (outcome: string): string =>
  `The outcome has been decided: "${outcome}". Play out a brief aftermath reaction from the figureheads.`
