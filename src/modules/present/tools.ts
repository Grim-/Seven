import { presentationTool } from '../../engine/present/define'
import { ToolError } from '../../engine/tools/types'

export const PRESENT_TOOLS = [
  presentationTool({
    type: 'card',
    group: 'present',
    description: 'Show a card: a title and a markdown body, with an optional footer line. Good for summaries, facts, notes and anything worth setting apart from the chat text.',
    fields: {
      title: { type: 'string', description: 'Card title' },
      body: { type: 'string', description: 'The card content, in markdown' },
      footer: { type: ['string', 'null'], description: 'A short line at the bottom, or null' }
    },
    check: (f) => {
      if (typeof f.title !== 'string' || !f.title.trim()) throw new ToolError('present_card needs a title. Call it again with title set to a few words, e.g. "Summary".')
      if (typeof f.body !== 'string' || !f.body.trim()) throw new ToolError('present_card needs a body. Call it again with body set to the card content in markdown.')
    },
    title: (f) => (typeof f.title === 'string' ? f.title : undefined)
  }),
  presentationTool({
    type: 'code',
    group: 'present',
    description: 'Show code with line numbers and a copy button.',
    fields: {
      title: { type: ['string', 'null'] },
      language: { type: ['string', 'null'] },
      code: { type: 'string' }
    },
    check: (f) => {
      if (typeof f.code !== 'string' || !f.code.trim()) throw new ToolError('present_code needs code. Call it again with code set to the code to show.')
    },
    title: (f) => (typeof f.title === 'string' && f.title ? f.title : typeof f.language === 'string' && f.language ? f.language : 'Code')
  }),
  presentationTool({
    type: 'document',
    group: 'present',
    description: "A working document: a draft you are shaping with the user, shown as a readable page (a title and a markdown body), best in the panel. Not for finished work: a final result goes in your reply, on a page with add_page, or wherever the user asked for it.",
    fields: {
      title: { type: 'string' },
      body: { type: 'string' }
    },
    check: (f) => {
      if (typeof f.body !== 'string' || !f.body.trim()) throw new ToolError('working_document needs a body. Call it again with body set to the draft in markdown.')
    },
    title: (f) => (typeof f.title === 'string' ? f.title : undefined)
  })
]
