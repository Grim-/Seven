import type { ModelInfo } from '@shared/types'
import { TraitChips, type ShellTrait } from '../ui'
import { formatBytes } from '../../lib/format'

export const MTP_NOTE = 'Seven uses them to draft several tokens at once while Multi-token prediction is on in the model\'s settings.'

export function modelTraits(info: ModelInfo | null | undefined, bytes?: number): ShellTrait[] {
  if (!info) return []
  const traits: ShellTrait[] = [
    ...(info.sizeLabel ? [{ key: 'params', label: info.sizeLabel, tone: 'warn' as const, hint: `${info.sizeLabel} parameters.` }] : []),
    ...(bytes ? [{ key: 'bytes', label: formatBytes(bytes), tone: 'busy' as const, hint: 'Size of the model file.' }] : []),
    info.experts
      ? { key: 'shape', label: `MoE ${info.experts.count}${info.experts.used ? `×${info.experts.used}` : ''}`, tone: 'ok', hint: `Mixture of experts: ${info.experts.count} experts${info.experts.used ? `, ${info.experts.used} used per token` : ''}.` }
      : { key: 'shape', label: 'Dense', hint: 'Every weight is used for every token.' }
  ]
  if (info.quant) traits.push({ key: 'quant', label: info.quant, tone: 'busy', hint: 'Quantization, from the file header.' })
  if (info.mtpLayers) traits.push({ key: 'mtp', label: 'MTP', tone: 'ok', hint: `Has ${info.mtpLayers} multi-token prediction layer${info.mtpLayers === 1 ? '' : 's'}. ${MTP_NOTE}` })
  if (info.imatrix) traits.push({ key: 'imatrix', label: 'imatrix', tone: 'ok', hint: ['Made with an importance matrix', info.imatrix.dataset, info.imatrix.chunks ? `${info.imatrix.chunks} chunks` : null].filter(Boolean).join(' · ') })
  return traits
}

export function ModelTraits({ info, bytes }: { info: ModelInfo | null | undefined; bytes?: number }) {
  return <TraitChips traits={modelTraits(info, bytes)} />
}
