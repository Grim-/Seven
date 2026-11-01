import { customCommands, expand } from './custom'
import type { ChatRunner } from '../chat/runner'
import type { SessionStore } from '../sessions/store'
import type { AgentRegistry } from '../agents/registry'
import { NEXT_TURN } from '../chat/history'
import { toolsFor } from '../tools/registry'
import { newId } from '../util/fs'
import { openProbePage, probePageTitle } from '../probe/probe'
import { profileLink } from '../user/identity'
import { SHEET_FIELDS } from '../library/sheets'
import { commandsFor, findCommand, firstSentence, parseArgs, registerCommand, registerCommandSource, toolUsage } from './registry'

interface Deps {
  runner: ChatRunner
  sessions: SessionStore
  agents: AgentRegistry
}

export function setupCommands({ runner, sessions, agents }: Deps): void {
  registerCommand({
    name: 'help',
    summary: 'List the commands you can type here.',
    usage: '`/help` lists the commands. `/help name` or `/name help` shows how to use one.',
    needsChat: false,
    run: async (args, ctx) => {
      const list = commandsFor(ctx)
      if (args) {
        const one = findCommand(list, args)
        if (!one) throw new Error(`There is no /${args.replace(/^\//, '')} here. Commands: ${list.map((c) => `/${c.name}`).join(', ')}`)
        return { text: one.usage, openSession: null }
      }
      return { text: list.map((c) => `- \`/${c.name}\` ${c.summary}`).join('\n'), openSession: null }
    }
  })

  registerCommand({
    name: 'compactnow',
    summary: 'Summarise the oldest turns now so the model has more room.',
    usage: '`/compactnow` summarises the oldest turns of this chat. The model gets the summary instead; the chat here keeps everything.',
    needsChat: true,
    run: async (_args, ctx) => {
      const { turns } = runner.compact(ctx.sessionId as string)
      return { text: `Summarising the oldest ${turns} turn${turns === 1 ? '' : 's'}.`, openSession: null }
    }
  })

  registerCommand({
    name: 'offboard',
    summary: 'Start a new chat that carries on from this one.',
    usage: '`/offboard` has the agent write a handoff (who, what, where, why, what is next), then opens a new chat with it, so you are not starting from scratch.',
    needsChat: true,
    run: async (_args, ctx) => {
      const from = sessions.get(ctx.sessionId as string)
      const text = await runner.handoff(from.id)
      const meta = sessions.create(from.agentId)
      sessions.saveContext(meta.id, {
        summaries: [{ id: newId('sum'), upTo: NEXT_TURN, text: `Carried over from the chat "${from.title}":\n\n${text}`, turns: 0, createdAt: Date.now() }]
      })
      return { text: null, openSession: meta.id }
    }
  })

  registerCommand({
    name: 'askme',
    summary: 'Have the agent ask you multiple-choice questions to pin down or vary something.',
    usage: '`/askme subject` has the agent ask you multiple-choice questions about it before doing anything, each one a different thing you could change. `/askme` on its own asks how to vary what you have right now.',
    needsChat: true,
    run: async (args, ctx) => {
      const sessionId = ctx.sessionId as string
      const agent = agents.getOrDefault(sessions.get(sessionId).agentId)
      if (!toolsFor(agent).some((t) => t.name === 'ask_user')) throw new Error(`${agent.name} can't show choices: turn on the UI tools for this agent first.`)
      const about = args.trim() ? `about this: ${args.trim()}` : 'about how to vary what we have right now (the last thing you made, or what we were just discussing)'
      const instruction = [
        `[Seven: the user ran /askme. Before doing anything else, use ask_user to ask them multiple-choice questions ${about}.`,
        'Each question pins down a different thing that would change the result: whatever matters for this subject, such as tone, length, setting, perspective, structure or constraints.',
        "Make the options really different from each other, not small variations of one idea, and don't reuse options you've offered earlier in this chat.",
        'Up to 4 questions with 3 to 6 short options each; use multiSelect where picking several makes sense.',
        'Do not do the task yet. Wait for the answers, then work from them.]'
      ].join(' ')
      await runner.send(sessionId, ctx.line, [], instruction)
      return { text: null, openSession: null }
    }
  })

  registerCommand({
    name: 'profile',
    summary: 'Have the agent create or update your User Profile page.',
    usage: '`/profile` has the agent create or update your profile page (user profile) with what it knows about you from this chat and its memory. `/profile something` adds what you type for it to include.',
    needsChat: true,
    run: async (args, ctx) => {
      const sessionId = ctx.sessionId as string
      const agent = agents.getOrDefault(sessions.get(sessionId).agentId)
      if (!toolsFor(agent).some((t) => t.name === 'add_page')) throw new Error(`${agent.name} can't write pages: turn on the Data tools for this agent first.`)
      const instruction = [
        `[Seven: the user ran /profile. Bring the page ${profileLink()} up to date with what you know about the user.`,
        'Read it first. If it does not exist, make it with add_page; if it does, change it with update_page.',
        'Draw on this chat, your memory, and anything the user added below.',
        "Keep what's there unless it's now wrong; add new things under fitting headings, short and one per line.",
        'Only write what the user has said or clearly shown, not guesses.',
        'Then say in a line or two what you added or changed.]'
      ].join(' ')
      const extra = args.trim() ? `\n\nThe user added: ${args.trim()}` : ''
      await runner.send(sessionId, ctx.line, [], instruction + extra)
      return { text: null, openSession: null }
    }
  })

  registerCommand({
    name: 'probe',
    summary: 'Open a chat where the agent questions you until it understands what you really want.',
    usage: '`/probe subject` (or `/probe @agent:Name subject` to pick who asks) opens a new chat with this agent that only asks you questions about the subject, line after line, until it can say what you say you want, what it thinks you want and what it thinks you actually want. Everything it learns goes on the page "Probe: subject" in Data; probing the same subject again (with any agent) starts from that page.',
    needsChat: false,
    run: async (args, ctx) => {
      const who = /(^|\s)@agent:("[^"]+"|\S+)/i.exec(args)
      const subject = (who ? args.replace(who[0], ' ') : args).replace(/\s+/g, ' ').trim()
      if (!subject) throw new Error('Say what to probe: /probe subject')
      let agentId = ctx.sessionId ? sessions.get(ctx.sessionId).agentId : ctx.agentId
      if (who) {
        const name = who[2].replace(/^"|"$/g, '').toLowerCase()
        const found = agents.list().find((a) => a.id === name || a.name.toLowerCase() === name)
        if (!found) throw new Error(`There is no agent "${who[2]}". Agents: ${agents.list().map((a) => a.name).join(', ')}`)
        agentId = found.id
      }
      const pageId = openProbePage(subject)
      const meta = sessions.create(agentId)
      sessions.update(meta.id, { title: probePageTitle(subject), probe: { subject, pageId } })
      const kickoff = `[Seven: start probing me about "${subject}". Read the probe page first, then ask your first question.]`
      await runner.send(meta.id, ctx.line, [], kickoff)
      return { text: null, openSession: meta.id }
    }
  })

  registerCommand({
    name: 'sheet',
    summary: 'Open a chat where the agent interviews you and builds a character sheet.',
    usage: '`/sheet idea` (or `/sheet @agent:Name idea`) opens a new chat where the agent asks you about the character one question at a time and writes the answers up as a character sheet in Data as it goes. The idea can be a name, a concept or nothing; naming an existing sheet fills in its gaps.',
    needsChat: false,
    run: async (args, ctx) => {
      const who = /(^|\s)@agent:("[^"]+"|\S+)/i.exec(args)
      const idea = (who ? args.replace(who[0], ' ') : args).replace(/\s+/g, ' ').trim()
      let agentId = ctx.sessionId ? sessions.get(ctx.sessionId).agentId : ctx.agentId
      if (who) {
        const name = who[2].replace(/^"|"$/g, '').toLowerCase()
        const found = agents.list().find((a) => a.id === name || a.name.toLowerCase() === name)
        if (!found) throw new Error(`There is no agent "${who[2]}". Agents: ${agents.list().map((a) => a.name).join(', ')}`)
        agentId = found.id
      }
      const agent = agents.getOrDefault(agentId)
      const tools = toolsFor(agent)
      if (!tools.some((t) => t.name === 'sheet_write')) throw new Error(`${agent.name} can't write character sheets: turn on the Data tools for this agent first.`)
      const choices = tools.some((t) => t.name === 'ask_user')
      const meta = sessions.create(agent.id)
      sessions.update(meta.id, { title: `Character sheet: ${idea || 'new'}` })
      const kickoff = [
        `[Seven: the user ran /sheet${idea ? ` with "${idea}"` : ''}. Interview them to build a character sheet, then keep it saved with sheet_write.`,
        'Ask one question at a time and wait for the answer.',
        choices ? 'Use ask_user with 3 to 6 short, really different options when choices help (they can always write their own); ask plainly when the answer is open or personal.' : '',
        `Start with who the character is (name, concept, where they come from), then work through the sheet's fields: ${SHEET_FIELDS.join(', ')}. Add a field if this character needs one.`,
        "Build on their answers; don't invent big facts they haven't given or picked, though small connecting detail is fine.",
        'If a sheet with that name already exists, read it first and fill its gaps instead of starting over.',
        'Once you know the name, save a first version with sheet_write and update it as answers come in, so the sheet grows in Data as you go.',
        'When the fields are covered, show the finished sheet and ask if anything should change.]'
      ]
        .filter(Boolean)
        .join(' ')
      await runner.send(meta.id, ctx.line, [], kickoff)
      return { text: null, openSession: meta.id }
    }
  })

  customCommands.setBuiltinCheck((name) => commandsFor({ sessionId: null, agentId: '' }).some((c) => c.name.toLowerCase() === name && !customCommands.find(name)))

  registerCommandSource(() =>
    customCommands.list().map((c) => ({
      name: c.name,
      summary: c.summary || firstSentence(c.prompt),
      usage: `\`/${c.name}${c.prompt.includes('{args}') ? ' …' : ''}\` sends this to the agent${c.prompt.includes('{args}') ? ', with what you type in place of {args}' : ''}:\n\n${c.prompt}`,
      needsChat: true,
      run: async (args, ctx) => {
        await runner.send(ctx.sessionId as string, ctx.line, [], expand(c, args))
        return { text: null, openSession: null }
      }
    }))
  )

  registerCommandSource(({ agentId }) =>
    toolsFor(agents.getOrDefault(agentId))
      .filter((t) => t.command)
      .map((tool) => {
        const usage = toolUsage(tool)
        const hasOptions = Object.keys((tool.params as { properties?: object }).properties ?? {}).length > 0
        return {
          name: tool.name,
          summary: firstSentence(tool.description),
          usage,
          needsChat: true,
          run: async (args, ctx) => {
            if (!args && hasOptions) return { text: usage, openSession: null }
            await runner.runToolCommand(ctx.sessionId as string, ctx.line, tool, parseArgs(args, tool.name))
            return { text: null, openSession: null }
          }
        }
      })
  )
}
