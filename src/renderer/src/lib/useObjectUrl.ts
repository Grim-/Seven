import { useEffect, useState } from 'react'

export function useObjectUrl(blob: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!blob) return setUrl(null)
    const made = URL.createObjectURL(blob)
    setUrl(made)
    return () => URL.revokeObjectURL(made)
  }, [blob])
  return url
}
