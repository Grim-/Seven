export interface DialogueChoice {
  id: string
  label: string
  nextNodeId?: string
  check?: {
    stat: 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA' | 'persuasion' | 'intimidation' | 'deception' | 'insight'
    dc: number
    successNodeId: string
    failureNodeId: string
  }
  action?: {
    type: 'shop' | 'giveItem' | 'takeGold' | 'setFlag' | 'battle' | 'exit' | 'recruit' | 'truce'
    payload?: Record<string, unknown>
  }
  condition?: {
    flagRequired?: string
    flagForbidden?: string
    itemRequired?: string
  }
}

export interface DialogueNode {
  id: string
  prompt: string
  speakerName?: string
  speakerSheet?: string
  choices: DialogueChoice[]
}

export interface DialogueTree {
  id: string
  sheetId: string
  title: string
  rootNodeId: string
  nodes: Record<string, DialogueNode>
}

export function defaultDialogueTree(sheetId: string, sheetName: string): DialogueTree {
  return {
    id: `tree_${sheetId}`,
    sheetId,
    title: `Dialogue with ${sheetName}`,
    rootNodeId: 'root',
    nodes: {
      root: {
        id: 'root',
        prompt: `Greetings, traveler. What brings you to speak with me?`,
        speakerName: sheetName,
        speakerSheet: sheetId,
        choices: [
          {
            id: 'c_rumors',
            label: 'Have you heard any rumors or news around here?',
            nextNodeId: 'node_rumors'
          },
          {
            id: 'c_persuade',
            label: '[Persuasion DC 12] "You look like someone who knows more than they let on."',
            check: {
              stat: 'persuasion',
              dc: 12,
              successNodeId: 'node_persuade_success',
              failureNodeId: 'node_persuade_failure'
            }
          },
          {
            id: 'c_leave',
            label: 'Never mind. I must be on my way. [Leave]',
            action: { type: 'exit' }
          }
        ]
      },
      node_rumors: {
        id: 'node_rumors',
        prompt: `The roads have grown dangerous lately. Strange sightings along the eastern borders have the guards on high alert.`,
        speakerName: sheetName,
        speakerSheet: sheetId,
        choices: [
          {
            id: 'c_back',
            label: 'Tell me something else.',
            nextNodeId: 'root'
          },
          {
            id: 'c_leave_2',
            label: 'I should prepare myself. [Leave]',
            action: { type: 'exit' }
          }
        ]
      },
      node_persuade_success: {
        id: 'node_persuade_success',
        prompt: `Keep your voice down... Since you ask with respect, I will tell you. There are old tunnels beneath the foundations that connect past the river patrol. Watch your step if you seek them out.`,
        speakerName: sheetName,
        speakerSheet: sheetId,
        choices: [
          {
            id: 'c_thanks',
            label: 'I appreciate the warning.',
            action: { type: 'exit' }
          }
        ]
      },
      node_persuade_failure: {
        id: 'node_persuade_failure',
        prompt: `I have nothing more to say to you on that subject. Tend to your own affairs.`,
        speakerName: sheetName,
        speakerSheet: sheetId,
        choices: [
          {
            id: 'c_apologize',
            label: 'My apologies. Let us speak of something else.',
            nextNodeId: 'root'
          },
          {
            id: 'c_leave_3',
            label: '[Leave]',
            action: { type: 'exit' }
          }
        ]
      }
    }
  }
}

export function combatParleyDialogueTree(sheetId: string, sheetName: string): DialogueTree {
  return {
    id: `parley_${sheetId}`,
    sheetId,
    title: `Parley with ${sheetName}`,
    rootNodeId: 'root',
    nodes: {
      root: {
        id: 'root',
        prompt: `*${sheetName} lowers their stance cautiously.* "Speak fast. Why should we stop fighting?"`,
        speakerName: sheetName,
        speakerSheet: sheetId,
        choices: [
          {
            id: 'c_persuade_parley',
            label: '[PERSUASION DC 12] "We gain nothing by dying here. Stand down, or join our party."',
            check: {
              stat: 'persuasion',
              dc: 12,
              successNodeId: 'node_parley_recruit',
              failureNodeId: 'node_parley_fail'
            }
          },
          {
            id: 'c_intimidate_parley',
            label: '[INTIMIDATION DC 13] "Look at your defenses. If you continue, you will not survive."',
            check: {
              stat: 'intimidation',
              dc: 13,
              successNodeId: 'node_parley_flee',
              failureNodeId: 'node_parley_fail'
            }
          },
          {
            id: 'c_resume_fight',
            label: '"Words are wasted. To arms!" [Resume combat]',
            action: { type: 'exit' }
          }
        ]
      },
      node_parley_recruit: {
        id: 'node_parley_recruit',
        prompt: `"You speak sense. I hold no true quarrel with your cause. I will stand with your party."`,
        speakerName: sheetName,
        speakerSheet: sheetId,
        choices: [
          {
            id: 'c_welcome',
            label: 'Welcome aboard. [Recruit to party]',
            action: { type: 'recruit' }
          }
        ]
      },
      node_parley_flee: {
        id: 'node_parley_flee',
        prompt: `*Eyes widening in caution, they lower their weapon.* "Fine! Take what you will, just let me leave with my life!"`,
        speakerName: sheetName,
        speakerSheet: sheetId,
        choices: [
          {
            id: 'c_let_go',
            label: 'Run, and do not look back. [Truce]',
            action: { type: 'truce' }
          }
        ]
      },
      node_parley_fail: {
        id: 'node_parley_fail',
        prompt: `"You talk too much! Die where you stand!"`,
        speakerName: sheetName,
        speakerSheet: sheetId,
        choices: [
          {
            id: 'c_defend',
            label: 'Steel yourself! [Resume combat]',
            action: { type: 'exit' }
          }
        ]
      }
    }
  }
}
