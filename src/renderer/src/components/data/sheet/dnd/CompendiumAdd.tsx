import { InlineEdit } from '../../../ui'

export function CompendiumAdd({ label, names, onAdd }: { label: string; names: string[]; onAdd: (name: string) => void }) {
  return <InlineEdit value="" placeholder={`+ ${label}`} suggestions={names} onSave={(name) => name && onAdd(name)} className="self-start text-[12px] text-faint hover:text-accent" />
}
