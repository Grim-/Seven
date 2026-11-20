import { cudaChoices, singleVariantChoice } from '../../../machine'
import { registerVariant } from './registry'

const CONTEXT = 'llama-server'

registerVariant({
  id: 'cuda',
  rank: 3,
  choices: (assets, m, settings) => cudaChoices(assets, m, settings, CONTEXT)
})

registerVariant({
  id: 'vulkan',
  rank: 2,
  choices: (assets, m, settings) => singleVariantChoice('vulkanBuildPattern', 'Vulkan', 'vulkan', m.vulkan ? null : 'No Vulkan driver found.', CONTEXT)(assets, settings)
})

registerVariant({
  id: 'cpu',
  rank: 1,
  choices: (assets, _m, settings) => singleVariantChoice('cpuBuildPattern', 'CPU', 'cpu', null, CONTEXT)(assets, settings)
})
