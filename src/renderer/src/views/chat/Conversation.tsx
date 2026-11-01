import type { ReactNode } from 'react'
import { Clapperboard } from 'lucide-react'
import { Button, MainPane, Panel, StatusBadge } from '../../components/ui'
import { Thread } from '../../components/chat/Thread'
import { ContextMeter, InstructionsBanner } from '../../components/chat/ContextMeter'
import { ModelPicker } from '../../components/chat/ModelPicker'
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
import type { AvatarSize } from '@shared/types'

const NEXT_SIZE: Record<AvatarSize, AvatarSize> = { small: 'medium', medium: 'large', large: 'small' }
const HEADER_AVATAR: Record<AvatarSize, number> = { small: 30, medium: 44, large: 64 }

export function Conversation({ lead }: { lead?: ReactNode }) {
  const chat = useOpenChat()
  const { conv, active, agent, agentId } = chat
  const activeId = conv.sessionId
  const [, setCinema] = useCinema()
  const updateSettings = useApp((st) => st.updateSettings)
  const avatarSize = useApp((st) => st.settings?.avatarSize ?? 'small')

  return (
    <>
      <MainPane id="chat">
        <Panel
          className="h-full min-w-0 flex-1"
          style={lookVars(agent?.look)}
          title={
            <span className="flex items-center gap-2.5">
              {lead}
              <button title={`Agent pictures: ${avatarSize} (click to change)`} onClick={() => void updateSettings({ avatarSize: NEXT_SIZE[avatarSize] })} className="shrink-0">
                <AgentAvatar agent={agent} size={HEADER_AVATAR[avatarSize]} sessionId={activeId} />
              </button>
              {active ? active.title : 'New chat'}
              {(active ? active.incognito : agent?.incognito) && <IncognitoMark />}
            </span>
          }
          actions={
            <>
              <PromptPeek />
              <ContextMeter />
              {active ? (
                <StatusBadge tone="idle" className="text-teal">
                  {agent?.name ?? 'Agent'}
                </StatusBadge>
              ) : (
                <div className="w-48">
                  <DraftAgentSelect conv={conv} agentId={agentId} />
                </div>
              )}
              <ChatSettings agent={agent ?? null} />
              <ModelPicker agentModelId={agent?.modelId ?? null} />
              <BackdropButton sessionId={activeId} />
              <Button size="sm" title="Cinema (Ctrl+Shift+F)" icon={<Clapperboard />} onClick={() => setCinema(true)} className="w-7 px-0" />
              <SidePanelToggle />
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
