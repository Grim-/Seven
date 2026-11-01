export const ROOT_FOLDER = '/'
export const FOLDER_TYPE = 'folder'

export const ASSET_ID = /^a_[a-z0-9]+$/

export const ASSET_IDS_IN = /\ba_[a-z0-9]+\b/g

export function isAssetId(value: unknown): value is string {
  return typeof value === 'string' && ASSET_ID.test(value)
}

export function idSegment(raw: string): string {
  return raw
    .normalize('NFKC')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^\p{L}\p{N}_.-]+/gu, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^[_.-]+|[_.-]+$/g, '')
}

export function fileName(raw: string): string {
  const base = raw.trim().replace(/^.*[\\/]/, '')
  const dot = base.lastIndexOf('.')
  const ext = dot > 0 ? base.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : ''
  const stem = idSegment(dot > 0 ? base.slice(0, dot) : base).slice(0, 120) || 'file'
  return ext ? `${stem}.${ext}` : stem
}

export function stripRef(raw: string): string {
  return raw
    .trim()
    .replace(/^seven:/i, '')
    .replace(/^@[a-z][\w.-]*:/i, '')
    .replace(/^"([\s\S]*)"$/, '$1')
    .replace(/^'([\s\S]*)'$/, '$1')
    .trim()
}

export function toId(raw: string): string {
  return stripRef(raw)
    .split('/')
    .map(idSegment)
    .filter(Boolean)
    .join('/')
}

export function showName(id: string): string {
  return id.replace(/_/g, ' ')
}
