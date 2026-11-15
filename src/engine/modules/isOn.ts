import { modules } from './registry'

export const moduleIsOn = (module: string): boolean => modules.list().some((m) => m.id === module && m.state === 'on')
