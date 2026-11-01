import path from 'node:path'
import type { WebLogEntry } from '@shared/types'
import { dataRoot } from './util/paths'
import { appendLine } from './util/fs'
import { sessionAccess } from './sessions/access'

export const WEB_LOG = path.join(dataRoot, 'weblog.jsonl')

export function logWeb(entry: WebLogEntry): void {
  if (sessionAccess.isIncognito(entry.sessionId)) return
  appendLine(WEB_LOG, entry)
}
