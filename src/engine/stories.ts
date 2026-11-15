import { notFound } from '@shared/errors'
import fs from 'node:fs'
import path from 'node:path'
import { EventEmitter } from 'node:events'
import type { StoryAction, StorySummary } from '@shared/types'
import { dataRoot } from './util/paths'
import { readJson, removePath, writeJson } from './util/fs'

export interface StoryRun {
  id: string
  template_id: string
  status?: 'active' | 'paused' | 'completed' | 'abandoned'
  current_act_index: number
  turn: number
  narrative_context: string
  current_cta: string
  facts: Record<string, { kind: string; status: string; summary: string }>
  closing_note?: string
  closed_at?: string
  at?: number
}

export const STORIES = path.join(dataRoot, 'moduledata', 'storyteller', 'stories')

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

class StoryStore extends EventEmitter {
  private file(id: string): string {
    const s = slug(id)
    if (!s) throw new Error(`"${id}" is not a story id. Story ids are made of letters, numbers, - and _, e.g. ember-forge.`)
    return path.join(STORIES, `${s}.json`)
  }

  list(): StoryRun[] {
    if (!fs.existsSync(STORIES)) return []
    return fs
      .readdirSync(STORIES)
      .filter((n) => n.endsWith('.json'))
      .map((n): StoryRun | null => {
        const file = path.join(STORIES, n)
        const run = readJson<StoryRun | null>(file, null)
        return run ? { ...run, at: fs.statSync(file).mtimeMs } : null
      })
      .filter((x): x is StoryRun => Boolean(x?.id))
      .sort((a, b) => (b.at ?? 0) - (a.at ?? 0))
  }

  summaries(): StorySummary[] {
    return this.list().map((r) => ({ id: r.id, template: r.template_id, status: r.status ?? 'active', act: r.current_act_index + 1, turn: r.turn ?? 0, note: r.closing_note ?? null, at: r.at ?? 0 }))
  }

  get(id: string): StoryRun {
    const file = this.file(id)
    const run = fs.existsSync(file) ? readJson<StoryRun | null>(file, null) : null
    if (!run) throw notFound(new Error(`There is no story "${id}"; it may have been deleted. Look it up with find, kind story.`))
    return run
  }

  act(id: string, action: StoryAction, note: string | null): StorySummary {
    const run = this.get(id)
    const status = run.status ?? 'active'
    const text = note?.trim() || (action === 'pause' ? 'Paused by the user.' : action === 'complete' ? 'Ended by the user.' : action === 'abandon' ? 'Abandoned by the user.' : '')
    if (action === 'resume') {
      if (status !== 'paused') throw new Error(status === 'active' ? 'This story is already running, so there is nothing to resume.' : `This story was ${status} and can't be resumed. Start a new story instead.`)
      run.status = 'active'
      delete run.closing_note
      delete run.closed_at
    } else {
      if (status !== 'active' && !(status === 'paused' && action !== 'pause')) throw new Error(`This story is already ${status}. Only a running story can be paused, and only a running or paused one can be completed or abandoned.`)
      run.status = action === 'pause' ? 'paused' : action === 'complete' ? 'completed' : 'abandoned'
      run.closing_note = text
      run.closed_at = new Date().toISOString()
      run.narrative_context = `${run.narrative_context ?? ''}\n- [${run.status.toUpperCase()}] ${text}`
    }
    writeJson(this.file(id), run)
    this.emit('changed')
    return this.summaries().find((s) => s.id === run.id)!
  }

  delete(id: string): void {
    this.get(id)
    removePath(this.file(id))
    this.emit('changed')
  }
}

export const storyRuns = new StoryStore()
