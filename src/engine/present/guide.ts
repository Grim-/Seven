import { presentationTypeOf } from '@shared/toolnames'

export function placesGuide(tools: { name: string; params: { properties?: Record<string, unknown> } }[]): string {
  const has = (n: string) => tools.some((t) => t.name === n)
  const show = has('show')
  const board = has('board')
  const present = tools.some((t) => presentationTypeOf(t.name) !== null && 'where' in (t.params.properties ?? {}))
  if (!show && !board && !present) return ''
  const lines = ['## Showing things', 'Seven stores things and draws them itself; never write markup, tables or code to display them.']
  if (show) lines.push('- show(things) shows anything you can link, in the chat.')
  if (present) {
    lines.push(`- Places (where) for present_* tools: inline (in the chat), panel (side panel, things to keep at hand), stage (fills the chat for a moment, big moments)${board ? ', board:<name> (a dashboard the user keeps open)' : ''}. key replaces an earlier one instead of adding another.`)
    lines.push('- present_* tools draw content at a place; Seven does the drawing, you fill the fields. Each is shown once; after it, carry on or finish your reply without repeating it as text.')
  }
  if (board) lines.push('- add_to_board puts things on a board; board changes and deletes boards and their widgets.')
  return lines.join('\n')
}
