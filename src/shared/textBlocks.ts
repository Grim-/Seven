export function editBlock(text: string, counts: (block: string) => boolean, index: number | null, next: string | null): string {
  const blocks = text.trim() ? text.trim().split(/\n\s*\n/) : []
  const at = index === null ? -1 : blocks.map((b, i) => (counts(b) ? i : -1)).filter((i) => i >= 0)[index]
  if (at === undefined || at < 0) return [...blocks, ...(next ? [next] : [])].join('\n\n')
  return [...blocks.slice(0, at), ...(next ? [next] : []), ...blocks.slice(at + 1)].join('\n\n')
}
