import { modules } from './registry'
import { agentAccess } from '../agents/access'

export const moduleIsOn = (module: string): boolean => modules.isOn(module)

export const moduleOnForAgent = (module: string, agentId: string | null): boolean =>
  modules.isOn(module) && (!agentId || agentAccess.get(agentId)?.modules.includes(module) === true)
