import { CHAT_BUSY } from '@shared/errors'

export class ChatBusy extends Error {
  readonly code = CHAT_BUSY

  constructor(message: string) {
    super(message)
    this.name = 'ChatBusy'
  }
}

export function isChatBusy(err: unknown): boolean {
  return err instanceof ChatBusy
}
