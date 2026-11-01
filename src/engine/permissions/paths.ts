function globToRegex(glob: string): RegExp {
  let out = ''
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i]
    if (ch === '*') {
      if (glob[i + 1] === '*') {
        const slash = glob[i + 2] === '/'
        out += slash ? '(?:.*/)?' : '.*'
        i += slash ? 2 : 1
      } else {
        out += '[^/]*'
      }
    } else if (ch === '?') {
      out += '[^/]'
    } else {
      out += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    }
  }
  return new RegExp(`^${out}$`, process.platform === 'win32' ? 'i' : '')
}

export function matchesProtected(relPath: string, patterns: string[]): string | null {
  const rel = relPath.split('\\').join('/')
  const base = rel.split('/').pop() ?? rel
  for (const pattern of patterns) {
    const p = pattern.split('\\').join('/').replace(/^\.\//, '')
    const re = globToRegex(p)
    if (p.includes('/') ? re.test(rel) : re.test(base) || re.test(rel)) return pattern
    if (p.endsWith('/**') && globToRegex(p.slice(0, -3)).test(rel)) return pattern
  }
  return null
}
