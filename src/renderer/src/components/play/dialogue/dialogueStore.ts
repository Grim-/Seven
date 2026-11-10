import { create } from 'zustand'
import type { DialogueTree, DialogueNode, DialogueChoice } from '@shared/game/dialogue'
import { rollDie } from '@shared/storyRolls'

export interface ActiveSpeechBubble {
  id: string
  sheet: string
  speakerName: string
  text: string
  expiresAt: number
  wide?: boolean
}

export interface NarrationLogEntry {
  id: string
  kind: 'dm' | 'npc' | 'player' | 'check'
  speaker: string
  text: string
  at: string
}

export interface DialogueState {
  activeTree: DialogueTree | null
  activeNode: DialogueNode | null
  speakerSheet: string | null
  speakerName: string | null
  
  // In-world bubbles
  bubbles: Record<string, ActiveSpeechBubble>
  
  // Floating top narration log
  narrationLog: NarrationLogEntry[]
  
  // Player chat recent stream
  playerChatLog: { id: string; speaker: string; text: string; kind: 'pc' | 'npc' | 'dm'; at: string }[]

  // Actions
  say: (sheet: string, speakerName: string, text: string, wide?: boolean) => void
  dismissBubble: (sheet: string) => void
  addNarration: (kind: 'dm' | 'npc' | 'player' | 'check', speaker: string, text: string) => void
  addPlayerChat: (speaker: string, text: string, kind: 'pc' | 'npc' | 'dm') => void
  clearNarration: () => void

  startDialogue: (tree: DialogueTree, speakerName?: string) => void
  pickChoice: (choice: DialogueChoice, playerMod?: number) => void
  closeDialogue: () => void
}

export const useDialogue = create<DialogueState>((set, get) => ({
  activeTree: null,
  activeNode: null,
  speakerSheet: null,
  speakerName: null,
  bubbles: {},
  narrationLog: [
    {
      id: 'initial_dm',
      kind: 'dm',
      speaker: 'WORLD NARRATOR',
      text: 'The common room is bathed in low candlelight. The smell of cedar embers, smoked trout, and bitter stout hangs in the air.',
      at: '12:00'
    }
  ],
  playerChatLog: [],

  say: (sheet, speakerName, text, wide = false) => {
    const id = crypto.randomUUID()
    const readDuration = Math.max(3500, text.length * 45)
    const expiresAt = Date.now() + readDuration

    set((state) => ({
      bubbles: {
        ...state.bubbles,
        [sheet]: { id, sheet, speakerName, text, expiresAt, wide }
      }
    }))

    // Echo to narration log & player chat log
    get().addNarration('npc', speakerName, text)
    get().addPlayerChat(speakerName, text, 'npc')

    // Auto dismiss after reading duration
    setTimeout(() => {
      const current = get().bubbles[sheet]
      if (current && current.id === id) {
        get().dismissBubble(sheet)
      }
    }, readDuration)
  },

  dismissBubble: (sheet) => {
    set((state) => {
      const { [sheet]: _removed, ...rest } = state.bubbles
      return { bubbles: rest }
    })
  },

  addNarration: (kind, speaker, text) => {
    const entry: NarrationLogEntry = {
      id: crypto.randomUUID(),
      kind,
      speaker,
      text,
      at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    set((state) => ({
      narrationLog: [...state.narrationLog.slice(-40), entry]
    }))
  },

  addPlayerChat: (speaker, text, kind) => {
    set((state) => ({
      playerChatLog: [
        ...state.playerChatLog.slice(-40),
        {
          id: crypto.randomUUID(),
          speaker,
          text,
          kind,
          at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]
    }))
  },

  clearNarration: () => {
    set({ narrationLog: [] })
  },

  startDialogue: (tree, speakerName) => {
    const root = tree.nodes[tree.rootNodeId] ?? Object.values(tree.nodes)[0]
    if (!root) return
    const name = speakerName ?? root.speakerName ?? tree.title
    set({
      activeTree: tree,
      activeNode: root,
      speakerSheet: tree.sheetId,
      speakerName: name
    })

    // Trigger in-world speech bubble for the initial greeting
    get().say(tree.sheetId, name, root.prompt)
  },

  pickChoice: (choice, playerMod = 0) => {
    const state = get()
    const tree = state.activeTree
    if (!tree) return

    // Log the player's picked choice
    get().addPlayerChat('Alistair Finch', choice.label, 'pc')

    // Handle Skill Check if present
    if (choice.check) {
      const roll = rollDie(20)
      const total = roll + playerMod
      const dc = choice.check.dc
      const success = total >= dc
      const nextId = success ? choice.check.successNodeId : choice.check.failureNodeId

      const rollResultText = `[${choice.check.stat.toUpperCase()} CHECK] Rolled ${roll} + ${playerMod} = ${total} vs DC ${dc} : ${success ? 'SUCCESS' : 'FAILURE'}`
      get().addNarration('check', 'SYSTEM', rollResultText)

      const nextNode = tree.nodes[nextId]
      if (nextNode) {
        set({ activeNode: nextNode })
        get().say(tree.sheetId, state.speakerName ?? tree.title, nextNode.prompt)
      } else {
        get().closeDialogue()
      }
      return
    }

    // Direct transition
    if (choice.nextNodeId && tree.nodes[choice.nextNodeId]) {
      const nextNode = tree.nodes[choice.nextNodeId]
      set({ activeNode: nextNode })
      get().say(tree.sheetId, state.speakerName ?? tree.title, nextNode.prompt)
      return
    }

    // Combat Parley outcomes
    if (choice.action?.type === 'recruit') {
      import('../state/gameStateStore').then(({ useGameState }) => {
        useGameState.getState().parleyWithEnemy(tree.sheetId, true)
      })
      get().closeDialogue()
      return
    }
    if (choice.action?.type === 'truce') {
      import('../state/gameStateStore').then(({ useGameState }) => {
        useGameState.getState().parleyWithEnemy(tree.sheetId, false)
      })
      get().closeDialogue()
      return
    }

    // Exit action or unhandled next
    if (choice.action?.type === 'exit' || !choice.nextNodeId) {
      get().closeDialogue()
    }
  },

  closeDialogue: () => {
    set({
      activeTree: null,
      activeNode: null,
      speakerSheet: null,
      speakerName: null
    })
  }
}))
