import type { ModuleFactory } from '../../engine/modules/sdk'
import { str, type ToolDef } from '../../engine/tools/types'
import { board } from '../../engine/board/store'

const addMessage: ToolDef = {
  name: 'add_message',
  group: 'board',
  needsWorkspace: false,
  description: 'Post a message on the board every agent shares.',
  params: { type: 'object', properties: { text: { type: 'string' } } },
  async execute(params, ctx) {
    board.add(ctx.agentId, str(params, 'text'))
    return 'Posted on the message board.'
  }
}

const readMessages: ToolDef = {
  name: 'read_messages',
  group: 'board',
  needsWorkspace: false,
  description: 'The latest messages on the shared board, oldest first.',
  params: { type: 'object', properties: { count: { type: 'integer', description: 'How many, e.g. 10' } } },
  async execute(params) {
    const list = board.recent(Math.min(50, Math.max(1, Number(params.count) || 10)))
    return list.length ? board.text(list) : { text: 'The message board is empty.', empty: true }
  }
}

const factory: ModuleFactory = (sdk) =>
  class extends sdk.ToolModule {
    define(tools: { add(tool: ToolDef): void }): void {
      for (const tool of [addMessage, readMessages]) tools.add(tool)
    }
  }

export default factory
