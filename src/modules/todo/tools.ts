import { newId } from '../../engine/util/fs'
import { ToolError, type ToolDef } from '../../engine/tools/types'
import { renderTodos, sessionAccess } from '../../engine/sessions/access'
import type { TodoItem, TodoStatus } from '@shared/types'

const STATUSES: TodoStatus[] = ['pending', 'doing', 'done']

const todoWrite: ToolDef = {
  name: 'todo_write',
  group: 'todo',
  needsWorkspace: false,
  maxRepeats: 2,
  description: 'Write your todo list for this chat. Replaces the whole list. Status is pending, doing or done; keep one item doing at a time.',
  params: {
    type: 'object',
    properties: {
      todos: {
        type: 'array',
        description: 'The full list, in order',
        items: {
          type: 'object',
          properties: {
            task: { type: 'string', description: 'What to do, short' },
            status: { enum: STATUSES, description: 'pending, doing or done' }
          }
        }
      }
    }
  },
  async execute(params, ctx) {
    if (!Array.isArray(params.todos)) throw new ToolError('Give todos as a list, e.g. [{"task": "Write the intro", "status": "doing"}]. status is one of: pending, doing, done.')
    const previous = sessionAccess.todos(ctx.sessionId)?.items ?? []
    const items: TodoItem[] = []
    for (const raw of params.todos as Record<string, unknown>[]) {
      const task = typeof raw?.task === 'string' ? raw.task.trim() : ''
      if (!task) continue
      const status = STATUSES.includes(raw.status as TodoStatus) ? (raw.status as TodoStatus) : 'pending'
      const same = previous.find((p) => p.task === task && !items.some((i) => i.id === p.id))
      items.push({ id: same?.id ?? newId('td'), task: task.slice(0, 300), status })
    }
    if (items.length > 50) throw new ToolError(`todos has ${items.length} items; keep it to 50 or fewer, e.g. by leaving out done ones.`)
    const list = sessionAccess.setTodos(ctx.sessionId, items)
    const done = list.items.filter((i) => i.status === 'done').length
    return `Todo list saved (${done}/${list.items.length} done):\n${renderTodos(list.items)}`
  }
}

const todoRead: ToolDef = {
  name: 'todo_read',
  group: 'todo',
  needsWorkspace: false,
  description: 'Read your todo list for this chat.',
  params: { type: 'object', properties: {} },
  async execute(_params, ctx) {
    return renderTodos(sessionAccess.todos(ctx.sessionId)?.items ?? [])
  }
}

export const TODO_TOOLS: ToolDef[] = [todoWrite, todoRead]
