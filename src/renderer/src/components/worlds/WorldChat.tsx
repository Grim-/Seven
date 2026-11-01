import { useEffect, useState } from 'react'
import type { WorldPost } from '@shared/world'
import { EmptyState, TraitChips } from '../ui'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { EntryCard, Lines, Loading } from '../entries/EntryCard'
import type { EntrySurfaceProps } from '../../registries/kinds'

function useWorld(id: string) {
  const list = useLive(() => engine('worlds.list'), 'worlds.changed')
  const [posts, setPosts] = useState<WorldPost[]>([])
  const world = list?.find((w) => w.id === id)
  useEffect(() => {
    if (!world) return
    void engine('worlds.board', { id })
      .then(setPosts)
      .catch(() => setPosts([]))
  }, [id, world?.updatedAt])
  return { list, world, posts: posts.slice(-3).reverse() }
}

function Counts({ types }: { types: { key: string; plural: string; count: number }[] }) {
  return <TraitChips traits={types.map((t) => ({ key: t.key, label: `${t.count} ${t.plural}` }))} />
}

function Posts({ posts }: { posts: WorldPost[] }) {
  return (
    <Lines
      items={posts.map((p, i) => (
        <span key={i} className="min-w-0">
          <b className="text-white">{p.author}</b>
          {p.to ? <span className="text-faint"> to {p.to}</span> : null}
          <span className="text-dim"> · {p.message}</span>
        </span>
      ))}
    />
  )
}

export function WorldChat({ id }: EntrySurfaceProps) {
  const { list, world, posts } = useWorld(id)
  if (!list) return <Loading />
  if (!world) return <EmptyState title="Removed">This world no longer exists.</EmptyState>
  return (
    <EntryCard title={world.name} tag="world" aside={<span className="font-mono text-[11px] text-faint">{world.posts} posts</span>}>
      <Counts types={world.types} />
      {posts.length > 0 && <Posts posts={posts} />}
    </EntryCard>
  )
}

export function WorldWidget({ id }: EntrySurfaceProps) {
  const { world, posts } = useWorld(id)
  if (!world) return <Loading />
  return (
    <div className="flex flex-col gap-2">
      <Counts types={world.types} />
      <Posts posts={posts.slice(0, 1)} />
    </div>
  )
}
