import type { ReactNode } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { MainPane, Panel, Popover } from '../../components/ui'
import { Thread } from '../../components/chat/Thread'
import { AgentSide } from '../../components/chat/AgentSide'
import { ContextMeter, InstructionsBanner } from '../../components/chat/ContextMeter'
import { PromptPeek } from '../../components/chat/PromptPeek'
import { SceneBadgeButton, SceneStrip } from '../../components/chat/SceneStrip'
import { MetaSceneStage } from '../../components/worldEvents/RoundTable'
import { ChatSettings } from '../../components/chat/ChatSettings'
import { ChatTabletop } from '../../components/chat/ChatTabletop'
import { useBoardSurfaces, useChatDashboard, useTabletopMode } from '../../components/chat/tabletopStore'
import { AgentAvatar, LookBackground, lookVars } from '../../components/agents/look'
import { VaultVeil } from '../../components/vault/Vault'
import { SidePanel, SidePanelToggle } from '../../components/side/SidePanel'
import { BackdropButton, ChatBackdrop, ChatsBackdrop, SurfaceBackdrop } from '../../components/backdrop/Backdrop'
import { useApp } from '../../store/app'
import { threadProps, useOpenChat } from '../../components/chat/useOpenChat'
import { DraftAgentSelect } from '../../components/chat/DraftAgentSelect'
import { IncognitoMark } from '../../components/chat/IncognitoMark'
import { agentSheets, type AvatarSize } from '@shared/types'

const NEXT_SIZE: Record<AvatarSize, AvatarSize> = { small: 'medium', medium: 'large', large: 'xl', xl: 'small' }
const HEADER_AVATAR: Record<AvatarSize, number> = { small: 30, medium: 40, large: 52, xl: 64 }

export function Conversation({ lead }: { lead?: ReactNode }) {
  const chat = useOpenChat()
  const { conv, active, agent, agentId } = chat
  const activeId = conv.sessionId
  const [tabletopMode] = useTabletopMode()
  const [dashboard] = useChatDashboard(activeId)
  const { activeSlot } = useBoardSurfaces(dashboard?.id ?? null)
  const surfaceTarget = dashboard ? { dashboardId: dashboard.id, surfaceId: activeSlot.id, label: activeSlot.label } : null
  const updateSettings = useApp((st) => st.updateSettings)
  const avatarSize = useApp((st) => st.settings?.avatarSize ?? 'small')

  const sheets = agentSheets(agent)
  const count = sheets.length

  const extras = (
    <>
      {(active ? active.incognito : agent?.incognito) && <IncognitoMark />}
      <SceneBadgeButton session={active ?? null} />
      <PromptPeek />
      {!active && (
        <div className="w-48">
          <DraftAgentSelect conv={conv} agentId={agentId} />
        </div>
      )}
      <BackdropButton
        sessionId={activeId}
        surfaceTarget={tabletopMode.windowed ? surfaceTarget : null}
        initialScope={tabletopMode.windowed && surfaceTarget ? 'surface' : undefined}
      />
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
              <span className="font-semibold text-ink tablet:truncate">
                {active ? active.title : 'New chat'}
              </span>
              <span className="contents tablet:hidden">{extras}</span>
              <span className="hidden tablet:flex">
                <Popover title="More" side="bottom" align="start" className="flex flex-col items-start gap-2 p-2" triggerClassName="h-7 w-7 justify-center border border-line/60 text-dim hover:border-accent hover:text-ink" trigger={<MoreHorizontal className="h-4 w-4" />}>
                  {extras}
                </Popover>
              </span>
            </span>
          }
          actions={
            <>
              <AgentSide agent={agent ?? null} height={HEADER_AVATAR[avatarSize]} />
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
          {tabletopMode.windowed && dashboard ? (
            <SurfaceBackdrop dashboardId={dashboard.id} surfaceId={activeSlot.id} />
          ) : (
            <>
              <ChatsBackdrop />
              <LookBackground look={agent?.look} />
              <ChatBackdrop sessionId={activeId} />
            </>
          )}
          <VaultVeil agentId={agentId ?? null} />
          <ChatTabletop sessionId={activeId} agent={agent ?? null}>
            {active?.scene?.mode === 'meta' && active.scene.eventId ? (
              <MetaSceneStage session={active} />
            ) : (
              <SceneStrip session={active ?? null} />
            )}
            <InstructionsBanner />
            <Thread
              key={activeId ?? 'new'}
              look={tabletopMode.windowed ? 'tabletop' : 'panel'}
              {...threadProps(chat, 'No model is loaded. Load one in Models, or give this agent a model, then start typing.')}
            />
          </ChatTabletop>
        </Panel>
      </MainPane>
      <SidePanel />
    </>
  )
}
