import { count, type GgufView } from '../view'

export function resolveMtpLayers(v: GgufView): number | null {
  const layers = count(v.arch.nextn_predict_layers)
  return layers && layers > 0 ? layers : null
}
