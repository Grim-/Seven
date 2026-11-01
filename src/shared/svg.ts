export const MAX_SVG = 200_000

export function cleanSvg(input: string): string {
  let s = input.trim()
  if (s.length > MAX_SVG) throw new Error(`The drawing is over ${MAX_SVG / 1000} KB`)
  s = s
    .replace(/^<\?xml[\s\S]*?\?>/i, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<!ENTITY[\s\S]*?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim()
  if (!/^<svg[\s>]/i.test(s) || !/<\/svg>\s*$/i.test(s)) throw new Error('A drawing must be one <svg>…</svg> element')
  s = s
    .replace(/<script[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<script[^>]*\/>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, '')
    .replace(/<(iframe|object|embed|audio|video)[\s\S]*?(<\/\1\s*>|\/>)/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(?:xlink:)?href\s*=\s*("([^"]*)"|'([^']*)')/gi, (m, _q, a, b) => {
      const v = String(a ?? b ?? '').trim()
      return v.startsWith('#') || v.startsWith('data:image/') ? m : ''
    })
    .replace(/url\(\s*(['"]?)(?!#|data:image\/)[^)]*\1\s*\)/gi, 'none')
    .replace(/@import[^;]*;?/gi, '')
  if (!/^<svg[^>]*\sxmlns\s*=/i.test(s)) s = s.replace(/^<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"')
  return s
}

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
