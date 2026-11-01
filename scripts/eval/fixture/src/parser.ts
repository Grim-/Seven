import { RETRY_LIMIT } from './config'

export function parseLine(line: string): string[] {
  return line.split(',').map((part) => part.trim())
}

export function parseWithRetry(input: string): string[] {
  for (let attempt = 0; attempt < RETRY_LIMIT; attempt++) {
    const result = parseLine(input)
    if (result.length) return result
  }
  return []
}
