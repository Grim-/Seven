import type { ReactNode } from 'react'
import { Clapperboard, MoreHorizontal } from 'lucide-react'
import { Button, MainPane, Panel, Popover } from '../../components/ui'
import { Thread } from '../../components/chat/Thread'
import { ContextMeter, InstructionsBanner } from '../../components/chat/ContextMeter'
import { PromptPeek } from '../../components/chat/PromptPeek'
import { ChatSettings } from '../../components/chat/ChatSettings'
import { AgentAvatar, LookBackground, lookVars } from '../../components/agents/look'
import { VaultVeil } from '../../components/vault/Vault'
import { SidePanel, SidePanelToggle } from '../../components/side/SidePanel'
import { BackdropButton, ChatBackdrop, ChatsBackdrop } from '../../components/backdrop/Backdrop'
import { useApp } from '../../store/app'
import { threadProps, useOpenChat } from '../../components/chat/useOpenChat'
import { DraftAgentSelect } from '../../components/chat/DraftAgentSelect'
import { useCinema } from '../../lib/cinema'
import { IncognitoMark } from '../../components/chat/IncognitoMark'
import { agentSheets, type AvatarSize } from '@shared/types'

const NEXT_SIZE: Record<AvatarSize, AvatarSize> = { small: 'medium', medium: 'large', large: 'small' }
const HEADER_AVATAR: Record<AvatarSize, number> = { small: 30, medium: 44, large: 64 }

export function Conversation({ lead }: { lead?: ReactNode }) {
  const chat = useOpenChat()
  const { conv, active, agent, agentId } = chat
  const activeId = conv.sessionId
  const [, setCinema] = useCinema()
  const updateSettings = useApp((st) => st.updateSettings)
  const avatarSize = useApp((st) => st.settings?.avatarSize ?? 'small')

  const sheets = agentSheets(agent)
  const count = sheets.length

  const extras = (
    <>
      {(active ? active.incognito : agent?.incognito) && <IncognitoMark />}
      <PromptPeek />
      {!active && (
        <div className="w-48">
          <DraftAgentSelect conv={conv} agentId={agentId} />
        </div>
      )}
      <BackdropButton sessionId={activeId} />
      <Button size="sm" title="Cinema (Ctrl+Shift+F)" icon={<Clapperboard />} onClick={() => setCinema(true)} className="w-7 px-0" />
      <ContextMeter />
    </>
  )

  return (
    <>
      <MainPane id="chat">
        <Panel
          className="h-full min-w-0 flex-1"
          style={lookVars(agent?.look)}
          lead={lead}
          tail={<SidePanelToggle />}
          title={
            <span className="flex items-center gap-2.5 tablet:min-w-0">
              <span className="font-semibold text-white tablet:truncate">
                {active ? active.title : 'New chat'}
              </span>
              <span className="contents tablet:hidden">{extras}</span>
              <span className="hidden tablet:flex">
                <Popover title="More" side="bottom" align="start" className="flex flex-col items-start gap-2 p-2" trigger={<Button size="sm" title="More" icon={<MoreHorizontal />} className="w-7 px-0" />}>
                  {extras}
                </Popover>
              </span>
            </span>
          }
          actions={
            <>
              {agent ? (
                <ChatSettings
                  agent={agent}
                  side="bottom"
                  align="end"
                  trigger={
                    <span
                      title={`${agent.name}${count > 1 ? ` (Playing ${count} characters)` : count === 1 ? ` (Playing @sheet:${sheets[0]})` : ''} · Click or right-click for settings · Shift+click to resize picture`}
                      onClick={(e) => {
                        if (e.shiftKey) {
                          e.stopPropagation()
                          void updateSettings({ avatarSize: NEXT_SIZE[avatarSize] })
                        }
                      }}
                      className="shrink-0 cursor-pointer transition-opacity hover:opacity-90"
                    >
                      <AgentAvatar agent={agent} size={HEADER_AVATAR[avatarSize]} sessionId={activeId} />
                    </span>
                  }
                />
              ) : (
                <AgentAvatar agent={null} size={HEADER_AVATAR[avatarSize]} sessionId={activeId} />
              )}
            </>
          }
          loading={chat.running || chat.loading}
          bodyClassName="relative flex flex-col p-0"
        >
          <ChatsBackdrop />
          <LookBackground look={agent?.look} />
          <ChatBackdrop sessionId={activeId} />
          <VaultVeil agentId={agentId ?? null} />
          <InstructionsBanner />
          <Thread key={activeId ?? 'new'} {...threadProps(chat, 'No model is loaded. Load one in Models, or give this agent a model, then start typing.')} />
        </Panel>
      </MainPane>
      <SidePanel />
    </>
  )
}
