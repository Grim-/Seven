import {
  renderExport,
  type ExportChoice,
  type ExportInfo,
  type ExportOptionInfo,
  type ExportPart,
  type ExportPreset
} from '@shared/exporting'

export interface ExportSection<C> {
  id: string
  label: string
  hint: string
  on: boolean
  size: (ctx: C) => string
  build: (ctx: C) => ExportPart
}

export interface ExportSource<C> {
  options: (Omit<ExportOptionInfo, 'value'> & { initial: string })[]
  presets: ExportPreset[] | ((ctx: C) => ExportPreset[])
  sections: ExportSection<C>[] | ((ctx: C) => ExportSection<C>[])
  context: (args: Record<string, string>, options: Record<string, string>) => C
  title: (ctx: C) => string
  subtitle: (ctx: C) => string
}

const sources = new Map<string, ExportSource<unknown>>()

export function registerExport<C>(id: string, source: ExportSource<C>): void {
  sources.set(id, source as ExportSource<unknown>)
}

function sourceOf(id: string): ExportSource<unknown> {
  const source = sources.get(id)
  if (!source) throw new Error(`Nothing can be exported as ${id}.`)
  return source
}

const listOf = <T, C>(value: T[] | ((ctx: C) => T[]), ctx: C): T[] => (typeof value === 'function' ? value(ctx) : value)

function optionValues(
  source: ExportSource<unknown>,
  given: Record<string, string>
): Record<string, string> {
  return Object.fromEntries(
    source.options.map((o) => [
      o.id,
      o.choices.some((c) => c.value === given[o.id]) ? given[o.id] : o.initial
    ])
  )
}

export function describeExport(
  id: string,
  args: Record<string, string>,
  given: Record<string, string>
): ExportInfo {
  const source = sourceOf(id)
  const options = optionValues(source, given)
  const ctx = source.context(args, options)
  return {
    title: source.title(ctx),
    subtitle: source.subtitle(ctx),
    sections: listOf(source.sections, ctx).map((s) => ({
      id: s.id,
      label: s.label,
      hint: s.hint,
      size: s.size(ctx),
      on: s.on
    })),
    options: source.options.map(({ initial: _initial, ...o }) => ({ ...o, value: options[o.id] })),
    presets: listOf(source.presets, ctx)
  }
}

export function buildExport(choice: ExportChoice): { title: string; text: string } {
  const source = sourceOf(choice.source)
  const ctx = source.context(choice.args, optionValues(source, choice.options))
  const title = source.title(ctx)
  const parts = listOf(source.sections, ctx)
    .filter((s) => choice.sections.includes(s.id))
    .map((s) => ({ id: s.id, part: s.build(ctx) }))
  return { title, text: renderExport(title, choice.brief, parts, choice.format) }
}
