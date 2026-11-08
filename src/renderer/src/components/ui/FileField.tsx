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

export function FileField({ value, onChange, filters, placeholder = 'No file' }: { value: string; onChange: (path: string) => void; filters: FileFilter[]; placeholder?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span title={value || undefined} className={cn('min-w-0 max-w-72 truncate font-mono text-[12px]', value ? 'text-white' : 'text-faint')}>
        {value ? fileName(value) : placeholder}
      </span>
      <Button size="sm" variant="ghost" icon={<FolderOpen />} onClick={() => pickFile(filters, onChange)}>
        {value ? 'Change' : 'Choose'}
      </Button>
      {value && <Button size="sm" variant="ghost" icon={<X />} title="Clear" onClick={() => onChange('')} />}
    </div>
  )
}
