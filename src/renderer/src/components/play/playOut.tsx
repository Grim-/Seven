import { MessageSquarePlus } from 'lucide-react'
import type { MenuItem } from '../ui'
import { startChatItems } from '../../views/data/entryMenu'
import { playText, type PlayWhere } from './playStore'

export function playOutItem(text: string, where: PlayWhere): MenuItem {
  const said = playText(where, text)
  return { label: 'Play this out', icon: <MessageSquarePlus />, children: startChatItems(where.link ? `${where.link}\n\n${said}` : said, where.agents) }
}
