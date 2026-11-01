import type { ReactNode } from 'react'
import { Calendar, CheckSquare, Hash, Image, Link, List, Tags, Type } from 'lucide-react'
import type { FieldType } from '@shared/types'

export const FIELD_TYPE_INFO: Record<FieldType, { label: string; icon: ReactNode; description: string }> = {
  text: { label: 'Text', icon: <Type className="h-3.5 w-3.5" />, description: 'Any words or sentences' },
  number: { label: 'Number', icon: <Hash className="h-3.5 w-3.5" />, description: 'A number you can sort and chart' },
  boolean: { label: 'Tick box', icon: <CheckSquare className="h-3.5 w-3.5" />, description: 'Yes or no, like done' },
  date: { label: 'Date', icon: <Calendar className="h-3.5 w-3.5" />, description: 'A day, shown on the calendar view' },
  select: { label: 'Choice', icon: <List className="h-3.5 w-3.5" />, description: 'One of a set of options you choose' },
  tags: { label: 'Tags', icon: <Tags className="h-3.5 w-3.5" />, description: 'Several short labels' },
  url: { label: 'Link', icon: <Link className="h-3.5 w-3.5" />, description: 'A web address' },
  asset: { label: 'File', icon: <Image className="h-3.5 w-3.5" />, description: 'A picture or other file from Seven' }
}
