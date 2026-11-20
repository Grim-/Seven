import type { Settings, StoredRelease } from './registry'

/** Return the hostname (or raw string if invalid) for a helper's releasesUrl setting. */
export function githubSource(settings: Settings): string {
  try {
    return new URL(String(settings.releasesUrl)).host
  } catch {
    return String(settings.releasesUrl)
  }
}

interface GithubRelease {
  tag_name: string
  name?: string | null
  draft?: boolean
  published_at?: string | null
  html_url?: string | null
  assets?: { name: string; size: number; browser_download_url: string; digest?: string | null }[]
}

export async function githubReleases(address: string, count: number, signal: AbortSignal): Promise<StoredRelease[]> {
  const url = new URL(address)
  url.searchParams.set('per_page', String(count))
  const res = await fetch(url, { signal, headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Seven' } })
  if (!res.ok) throw new Error(`${url.host} answered ${res.status} when Seven asked for the releases. Check your internet connection and the releases address in settings.`)
  const list = (await res.json()) as GithubRelease[]
  return list
    .filter((r) => !r.draft)
    .map((r) => ({
      tag: r.tag_name,
      name: r.name || r.tag_name,
      publishedAt: r.published_at ?? null,
      url: r.html_url ?? null,
      assets: (r.assets ?? []).map((a) => ({ name: a.name, size: a.size, url: a.browser_download_url, sha256: a.digest?.startsWith('sha256:') ? a.digest.slice(7).toLowerCase() : null }))
    }))
}
