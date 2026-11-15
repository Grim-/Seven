import { useTools } from '../store/tools'

export const moduleOn = (module: string): boolean => useTools.getState().list.some((m) => m.id === module && m.state === 'on')
