import type { ModelInfo } from '@shared/types'
import { TraitChips, type ShellTrait } from '../ui'

export const MTP_NOTE = "Seven can't use MTP yet: node-llama-cpp, which runs models in Seven, doesn't expose llama.cpp's MTP drafting."

export function modelTraits(info: ModelInfo | null | undefined): ShellTrait[] {
  if (!info) return []
  const traits: ShellTrait[] = [
    info.experts
      ? { key: 'shape', label: `MoE ${info.experts.count}${info.experts.used ? `×${info.experts.used}` : ''}`, tone: 'ok', hint: `Mixture of experts: ${info.experts.count} experts${info.experts.used ? `, ${info.experts.used} used per token` : ''}.` }
      : { key: 'shape', label: 'Dense', hint: 'Every weight is used for every token.' }
  ]
  if (info.quant) traits.push({ key: 'quant', label: info.quant, tone: 'busy', hint: 'Quantization, from the file header.' })
  if (info.mtpLayers) traits.push({ key: 'mtp', label: 'MTP', tone: 'warn', hint: `Has ${info.mtpLayers} multi-token prediction layer${info.mtpLayers === 1 ? '' : 's'}. ${MTP_NOTE}` })
  if (info.imatrix) traits.push({ key: 'imatrix', label: 'imatrix', tone: 'ok', hint: ['Made with an importance matrix', info.imatrix.dataset, info.imatrix.chunks ? `${info.imatrix.chunks} chunks` : null].filter(Boolean).join(' · ') })
  return traits
}

export function ModelTraits({ info }: { info: ModelInfo | null | undefined }) {
  return <TraitChips traits={modelTraits(info)} />
}
