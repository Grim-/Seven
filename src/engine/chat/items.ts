export interface SystemItem {
  type: 'system'
  text: string
}

export interface UserItem {
  type: 'user'
  text: string
  images?: string[]
}

export interface FunctionCallItem {
  type: 'functionCall'
  name: string
  description?: string
  params: unknown
  result: unknown
  thoughtSignature?: string
  startsNewChunk?: boolean
}

export interface SegmentItem {
  type: 'segment'
  segmentType: 'thought' | 'comment'
  text: string
  ended: boolean
}

export interface ModelItem {
  type: 'model'
  response: (string | FunctionCallItem | SegmentItem)[]
}

export type ChatHistoryItem = SystemItem | UserItem | ModelItem
