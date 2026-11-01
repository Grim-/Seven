import { useEffect, useState } from 'react'
import { engine, on } from '../../lib/ipc'
import { onLibraryChange } from '../../lib/library'

export interface Token {
  value: string
  hint?: string
}

export function useRepoTokens(): Token[] {
  const [tokens, setTokens] = useState<Token[]>([])
  useEffect(() => {
    const load = () =>
      void engine('repos.list')
        .then((repos) => {
          const tags = [...new Set(repos.flatMap((r) => r.tags))]
          setTokens([
            ...repos.map((r) => ({ value: r.title, hint: `${r.values.length} values${r.scope === 'run' ? ', kept for the run' : ''}` })),
            ...tags.map((t) => ({ value: `tag:${t}`, hint: 'any repo with this tag' }))
          ])
        })
        .catch(() => setTokens([]))
    load()
    const off = onLibraryChange(load)
    const offPage = on('page.changed', load)
    return () => {
      off()
      offPage()
    }
  }, [])
  return tokens
}
