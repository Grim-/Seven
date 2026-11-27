import { parseGuideMarkdown, resolveGuideMediaUrl, type GuideDoc } from './parser'

const rawPages = import.meta.glob('./pages/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const rawMedia = import.meta.glob('./media/*.{png,jpg,jpeg,webp,gif,svg,avif}', { import: 'default', eager: true }) as Record<string, string>

export const GUIDE_MEDIA: Record<string, string> = Object.fromEntries(
  Object.entries(rawMedia).map(([key, url]) => {
    const file = key.replace(/\\/g, '/').split('/').pop() ?? key
    return [file.toLowerCase(), url]
  })
)

export const BUILTIN_GUIDES: GuideDoc[] = Object.entries(rawPages)
  .map(([filePath, raw]) => {
    const file = filePath.replace(/\\/g, '/').split('/').pop() ?? filePath
    const slug = file.replace(/\.md$/i, '')
    return parseGuideMarkdown(slug, raw, file)
  })
  .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))

export interface GuideSectionGroup {
  section: string
  guides: GuideDoc[]
}

export function groupGuidesBySection(guides: readonly GuideDoc[]): GuideSectionGroup[] {
  const bySection = new Map<string, GuideDoc[]>()
  for (const g of guides) {
    const list = bySection.get(g.section) ?? []
    list.push(g)
    bySection.set(g.section, list)
  }
  return [...bySection.entries()].map(([section, items]) => ({ section, guides: items }))
}

export function resolveGuideMedia(src: string | undefined): string | undefined {
  return resolveGuideMediaUrl(src, GUIDE_MEDIA)
}
