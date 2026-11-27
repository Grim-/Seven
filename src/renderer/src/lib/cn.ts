import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

const twMerge = extendTailwindMerge<'type-role'>({
  extend: {
    theme: {
      color: ['panel', 'surface', 'well', 'scrim', 'shade', 'ink', 'on-accent', 'secondary', 'secondary-ink', 'warn', 'page', 'tint-cyan', 'tint-teal', 'tint-purple', 'tint-purple-ink', 'tint-red', 'tint-red-ink', 'tint-amber', 'tint-amber-ink', 'tint-green', 'tint-green-ink', 'tint-sky', 'tint-sky-ink', 'tint-yellow', 'tint-yellow-ink', 'tint-orange'],
      font: ['ui', 'label', 'heading', 'body', 'data', 'mono'],
      shadow: ['panel', 'glow', 'glow-strong']
    },
    classGroups: {
      'type-role': ['type-eyebrow', 'type-label', 'type-title', 'type-heading', 'type-data'],
      'text-transform': ['caps', { caps: [(v: string) => /^\d+(\.\d+)?$/.test(v)] }],
      'bg-color': [{ tone: [(v: string) => /^(panel|card|card-hover|surface|well|sidebar|bg)-\d+$/.test(v)] }]
    }
  }
})

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
