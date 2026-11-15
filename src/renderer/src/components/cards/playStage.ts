import type { ReactNode } from 'react'
import { create } from 'zustand'
import type { PlayOutcome, PlaySurface } from '../play/playStore'
import type { Card } from './model'

const STAMP_MS = 900
const BURN_MS = 1100

export interface Stage {
  token: object
  card: Card
  title: string
  node: ReactNode
  face: number | null | undefined
  outcome: PlayOutcome | null
  burning: boolean
  close: () => void
}

export const usePlayStage = create<{ stage: Stage | null }>(() => ({ stage: null }))

export function stageSurface(card: Card, done: (outcome: PlayOutcome | null) => void = () => undefined): PlaySurface {
  const token = {}
  let finished = false
  const finish = (outcome: PlayOutcome | null) => {
    if (finished) return
    finished = true
    done(outcome)
  }
  const update = (change: Partial<Stage>) => {
    const stage = usePlayStage.getState().stage
    if (stage?.token === token) usePlayStage.setState({ stage: { ...stage, ...change } })
  }
  const close = () => {
    finish(null)
    if (usePlayStage.getState().stage?.token === token) usePlayStage.setState({ stage: null })
  }
  usePlayStage.getState().stage?.close()
  usePlayStage.setState({ stage: { token, card, title: '', node: null, face: undefined, outcome: null, burning: false, close } })
  return {
    show: (title, node) => update({ title, node }),
    clear: () => update({ title: '', node: null }),
    close,
    roll: (face) => update({ face }),
    settle: (outcome) => {
      finish(outcome)
      update({ outcome })
      window.setTimeout(() => update({ burning: true }), STAMP_MS)
      window.setTimeout(close, STAMP_MS + BURN_MS)
    }
  }
}
