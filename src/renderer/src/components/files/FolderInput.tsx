import { useMemo, useState } from 'react'
import { FOLDER_TYPE } from '@shared/ids'
import { Input, SuggestList, useSuggest } from '../ui'
import { pagePath, useData } from '../../store/data'

export function FolderInput({ value, onChange, placeholder = 'pictures/imports' }: { value: string; onChange: (folder: string) => void; placeholder?: string }) {
  const pages = useData((s) => s.pages)
  const folders = useMemo(() => pages.filter((p) => p.type === FOLDER_TYPE).map((p) => pagePath(pages, p.id)).sort(), [pages])
  const [focus, setFocus] = useState(false)
  const { options, pick, current, move } = useSuggest(folders, value, [value.trim()])
  return (
    <div className="relative">
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        onKeyDown={(e) => {
          if (move(e)) return
          if ((e.key === 'Enter' || e.key === 'Tab') && current) {
            e.preventDefault()
            onChange(current)
          }
        }}
        className="font-ui text-[12px]"
      />
      {focus && <SuggestList options={options} pick={pick} onPick={onChange} className="right-0" />}
    </div>
  )
}
