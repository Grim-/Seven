import { icons, LayoutDashboard, type LucideProps } from 'lucide-react'

function pascal(name: string): string {
  return name
    .split('-')
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join('')
}

export function DashboardIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = (icons as Record<string, typeof LayoutDashboard>)[pascal(name)] ?? LayoutDashboard
  return <Icon {...props} />
}
