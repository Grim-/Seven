function closeUp(text: string): string | null {
  const stack: string[] = []
  let inString = false
  let escaped = false
  let lastSafe = -1
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (c === '\\') escaped = true
      else if (c === '"') inString = false
      continue
    }
    if (c === '"') inString = true
    else if (c === '{' || c === '[') stack.push(c === '{' ? '}' : ']')
    else if (c === '}' || c === ']') stack.pop()
    else if (c === ',') lastSafe = i
  }
  let body = text
  if (inString) body = (escaped ? body.slice(0, -1) : body) + '"'
  body = body.replace(/[\s,]+$/, '')
  if (/:\s*$/.test(body)) body += 'null'
  else if (/[{,]\s*"(?:[^"\\]|\\.)*"$/.test(body)) body += ':null'
  const tail = stack.slice().reverse().join('')
  const attempt = body + tail
  try {
    JSON.parse(attempt)
    return attempt
  } catch {
    if (lastSafe < 0) return null
    return closeUp(text.slice(0, lastSafe))
  }
}

export function parsePartialObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{')
  if (start < 0) return null
  const fixed = closeUp(text.slice(start))
  if (!fixed) return null
  try {
    const value = JSON.parse(fixed)
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
  } catch {
    return null
  }
}
