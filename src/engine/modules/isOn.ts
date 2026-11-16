import { modules } from './registry'

export const moduleIsOn = (module: string): boolean => modules.isOn(module)
