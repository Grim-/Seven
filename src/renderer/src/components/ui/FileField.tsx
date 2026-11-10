import { FolderOpen, X } from 'lucide-react'
import { Button } from './Button'
import { main } from '../../lib/ipc'
import { failed } from '../../lib/notify'
import { cn } from '../../lib/cn'

export type FileFilter = { name: string; extensions: string[] }

export function pickFile(filters: FileFilter[], onPicked: (path: string) => void): void {
  void main('dialog.openFile', { filters })
    .then((path) => path && onPicked(path))
    .catch(failed('Could not open the file picker'))
}

export function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path
}

export function pickFolder(onPicked: (path: string) => void): void {
  void main('dialog.openFolder')
    .then((path) => path && onPicked(path))
    .catch(failed('Could not open the folder picker'))
}

export function FileField({ value, onChange, filters = [], folder = false, placeholder = folder ? 'No folder' : 'No file' }: { value: string; onChange: (path: string) => void; filters?: FileFilter[]; folder?: boolean; placeholder?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span title={value || undefined} className={cn('min-w-0 truncate font-mono text-[12px]', folder ? 'flex-1' : 'max-w-72', value ? 'text-white' : 'text-faint')}>
        {value ? (folder ? value : fileName(value)) : placeholder}
      </span>
      <Button size="sm" variant="ghost" icon={<FolderOpen />} onClick={() => (folder ? pickFolder(onChange) : pickFile(filters, onChange))}>
        {value ? 'Change' : 'Choose'}
      </Button>
      {value && <Button size="sm" variant="ghost" icon={<X />} title="Clear" onClick={() => onChange('')} />}
    </div>
  )
}
