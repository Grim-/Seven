import { icons, type LucideProps } from 'lucide-react'

export function NamedIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = icons[name as keyof typeof icons] ?? icons.Sparkles
  return <Icon {...props} />
}
