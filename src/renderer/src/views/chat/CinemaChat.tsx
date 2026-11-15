import { ImageIcon, MessagesSquare, Minimize2, Plus, SlidersHorizontal } from 'lucide-react'
import { Thread } from '../../components/chat/Thread'
import { AgentPresence } from '../../components/chat/AgentPresence'
import { DraftAgentSelect } from '../../components/chat/DraftAgentSelect'
import { RecentChats } from '../../components/chat/RecentChats'
import { ChatSettings } from '../../components/chat/ChatSettings'
import { ContextMeter, InstructionsBanner } from '../../components/chat/ContextMeter'
import { threadProps, useOpenChat } from '../../components/chat/useOpenChat'
import { LookBackground, lookVars } from '../../components/agents/look'
import { BackdropButton, ChatBackdrop, ChatsBackdrop } from '../../components/backdrop/Backdrop'
import { VaultVeil } from '../../components/vault/Vault'
import { EdgeRail, HudFrame, Popover, RailButton, RailItem, SquareIcon } from '../../components/ui'
import { useSessions } from '../../store/sessions'
import { useEscapeLayer } from '../../lib/escape'
import { useKeybindLabel } from '../../store/keybinds'

export function CinemaChat({ onLeave }: { onLeave: () => void }) {
  const chat = useOpenChat()
  const { conv, active, agent, agentId } = chat
  const modeKey = useKeybindLabel('chat.cycleMode')
  const cinemaKey = useKeybindLabel('chat.cinema')
  useEscapeLayer(true, onLeave)
  return (
    <div style={lookVars(agent?.look)} className="relative h-full overflow-hidden bg-bg">
      <ChatsBackdrop />
      <LookBackground look={agent?.look} />
      <ChatBackdrop sessionId={conv.sessionId} />
      <HudFrame
        title={active?.title ?? 'New chat'}
        hint={
          <>
            <b>Esc</b> leave · <b>{modeKey}</b> view · <b>{cinemaKey}</b> cinema
          </>
        }
      />
      <div className="relative z-10 mx-auto flex h-full w-[calc(100%-13rem)] flex-col pb-8 pt-10">
        <AgentPresence agent={agent} sessionId={conv.sessionId} size="hero" eyebrow={active?.title ?? 'New chat'}>
          <div className="mb-1 flex shrink-0 flex-col items-end gap-2">
            {!active && <DraftAgentSelect conv={conv} agentId={agentId} className="h-7 w-44 text-[12px]" />}
            <ContextMeter />
          </div>
        </AgentPresence>
        <div className="relative flex min-h-0 flex-1 flex-col">
          <VaultVeil agentId={agentId} />
          <InstructionsBanner />
          <Thread key={conv.sessionId ?? 'new'} look="cinema" {...threadProps(chat, 'No model is loaded. Load one in Models, or give this agent a model, then start typing.')} />
        </div>
      </div>
      <EdgeRail>
        <RailButton label="Leave · Esc" onClick={onLeave} active>
          <Minimize2 />
        </RailButton>
        <RailButton label="New chat" onClick={() => useSessions.getState().startNew(conv)}>
          <Plus />
        </RailButton>
        <RailItem label="Chats">
          <Popover
            title="Chats"
            trigger={
              <SquareIcon>
                <MessagesSquare />
              </SquareIcon>
            }
          >
            {(close) => <RecentChats conv={conv} onPick={close} />}
          </Popover>
        </RailItem>
        <RailItem label="Chat settings">
          <ChatSettings
            agent={agent}
            trigger={
              <SquareIcon>
                <SlidersHorizontal />
              </SquareIcon>
            }
          />
        </RailItem>
        <RailItem label="Backdrop">
          <BackdropButton
            sessionId={conv.sessionId}
            trigger={
              <SquareIcon>
                <ImageIcon />
              </SquareIcon>
            }
          />
        </RailItem>
      </EdgeRail>
    </div>
  )
}
