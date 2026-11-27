import { useEffect, useState } from 'react'
import { plainValue, type WorldPost } from '@shared/world'
import { EmptyState, TraitChips } from '../ui'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { EntryCard, Facts, Lines, Loading } from '../entries/EntryCard'
import type { EntrySurfaceProps } from '../../registries/kinds'
import { noteFailure } from '../../store/problems'
import { worldPartUi } from './worldPartUis'
import './worldSubPartUis'

function useWorld(id: string) {
  const list = useLive(() => engine('worlds.list'), 'worlds.changed')
  const [posts, setPosts] = useState<WorldPost[]>([])
  const world = list?.find((w) => w.id === id)
  useEffect(() => {
    if (!world) return
    void engine('worlds.board', { id })
      .then(setPosts)
      .catch(noteFailure('worlds', 'Could not load the board', () => setPosts([])))
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
          <b className="text-ink">{p.author}</b>
          {p.to ? <span className="text-faint"> to {p.to}</span> : null}
          <span className="text-dim"> · {p.message}</span>
        </span>
      ))}
    />
  )
}

function WorldRecordChat({ worldId, typeKey, itemKey }: { worldId: string; typeKey: string; itemKey: string }) {
  const worlds = useLive(() => engine('worlds.list'), 'worlds.changed')
  const records = useLive(
    () => engine('worlds.records', { id: worldId, type: typeKey }),
    ['worlds.changed', 'saves.changed'],
    [worldId, typeKey]
  )
  if (!worlds || !records) return <Loading />
  const world = worlds.find((w) => w.id === worldId)
  if (!world) return <EmptyState title="Removed">This world no longer exists.</EmptyState>
  const record = records[itemKey]
  if (!record) return <EmptyState title="Removed">This record no longer exists.</EmptyState>

  const title = typeof record.Name === 'string' && record.Name.trim() ? record.Name : itemKey
  const rows: [string, React.ReactNode][] = [
    ['World', world.name],
    ...Object.entries(record)
      .filter(([k, v]) => k !== 'Name' && plainValue(v).trim() !== '')
      .slice(0, 5)
      .map(([k, v]): [string, React.ReactNode] => [k, plainValue(v)])
  ]
  return (
    <EntryCard title={title} tag={typeKey}>
      <Facts rows={rows} />
    </EntryCard>
  )
}

function splitWorldSubRef(id: string): { worldId: string; segment: string; itemKey: string } | null {
  const parts = id.split('/')
  if (parts.length < 3 || !parts[0] || !parts[1] || !parts[2]) return null
  return { worldId: parts[0], segment: parts[1], itemKey: parts.slice(2).join('/') }
}

export function WorldChat({ id, part }: EntrySurfaceProps) {
  const sub = splitWorldSubRef(id)
  if (sub) {
    const partSurface = worldPartUi(sub.segment)
    if (partSurface) return <partSurface.Chat worldId={sub.worldId} itemKey={sub.itemKey} part={part} />
    return <WorldRecordChat worldId={sub.worldId} typeKey={sub.segment} itemKey={sub.itemKey} />
  }

  const { list, world, posts } = useWorld(id)
  if (!list) return <Loading />
  if (!world) return <EmptyState title="Removed">This world no longer exists.</EmptyState>
  return (
    <EntryCard title={world.name} tag="world" aside={<span className="font-ui text-[11px] text-faint">{world.posts} posts</span>}>
      <Counts types={world.types} />
      {posts.length > 0 && <Posts posts={posts} />}
    </EntryCard>
  )
}

export function WorldWidget({ id, part }: EntrySurfaceProps) {
  const sub = splitWorldSubRef(id)
  if (sub) {
    const partSurface = worldPartUi(sub.segment)
    const SubWidget = partSurface?.Widget ?? partSurface?.Chat
    if (SubWidget) return <SubWidget worldId={sub.worldId} itemKey={sub.itemKey} part={part} />
    return <WorldRecordChat worldId={sub.worldId} typeKey={sub.segment} itemKey={sub.itemKey} />
  }

  const { world, posts } = useWorld(id)
  if (!world) return <Loading />
  return (
    <div className="flex flex-col gap-2">
      <Counts types={world.types} />
      <Posts posts={posts.slice(0, 1)} />
    </div>
  )
}
