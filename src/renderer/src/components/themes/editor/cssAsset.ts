const URL_ASSET = /url\(\s*(['"]?)(a_[a-z0-9]+)\1\s*\)/

export function assetIn(value: string): string | undefined {
  return URL_ASSET.exec(value)?.[2]
}

export function assetValue(id: string): string {
  return `url(${id})`
}
