import { Blocks, BookOpen, Compass, Layers, MapPin, PanelRight, Sparkles } from 'lucide-react'
import type { ComponentType } from 'react'
import type { ModuleInfo, PageTypeInfo } from '@shared/types'
import { KindIcon } from '../../lib/library'
import { kindModuleLists } from '../../registries/kinds'

interface CategoryMeta {
  icon: ComponentType<{ className?: string }>
  hint: string
}

const CATEGORY_META: Record<string, CategoryMeta> = {
  kind: { icon: Blocks, hint: 'Adds library entry types in Data & agent @references.' },
  bestiary: { icon: Sparkles, hint: 'Adds creature blueprints usable in worlds and encounters.' },
  'map tokens': { icon: MapPin, hint: 'Adds interactive token types onto maps and battlegrounds.' },
  'sheet tab': { icon: Layers, hint: 'Adds an extra workspace tab inside character sheets.' },
  'card variations': { icon: BookOpen, hint: 'Extends cards with new playable or visual card mechanics.' }
}

const DEFAULT_CATEGORY_META: CategoryMeta = {
  icon: Compass,
  hint: 'Capabilities contributed by this module to Seven.'
}

function metaForCategory(label: string): CategoryMeta {
  return CATEGORY_META[label.trim().toLowerCase()] ?? DEFAULT_CATEGORY_META
}

function pageBadges(page: PageTypeInfo): string[] {
  const badges: string[] = []
  if (page.group) badges.push(page.group)
  if (page.single) badges.push('Single page')
  if (page.rollable) badges.push('Rollable')
  if (page.panel) badges.push('Side panel')
  if (page.view) badges.push(`View: ${page.view}`)
  if (page.widget) badges.push(`Widget: ${page.widget}`)
  return badges
}

export function ModuleAdds({ module }: { module: ModuleInfo }) {
  const dynamicLists = kindModuleLists().flatMap((g) => {
    const items = g.list.ofModule(module.id)
    return items.length ? [{ label: g.label, items }] : []
  })
  const groups = [...module.adds, ...dynamicLists]
  const mainTabs = module.id === 'image' ? [{ label: 'Image', description: 'Adds a dedicated Image workspace tab to the main taskbar for prompting and configuring sd-server or remote image generation directly.' }] : []
  const hasAnything = Boolean(module.panel) || module.pages.length > 0 || groups.length > 0 || mainTabs.length > 0

  if (!hasAnything) return null

  return (
    <div className="flex flex-col gap-3">
      <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-accent-soft">
        What it adds
      </div>

      {mainTabs.map((tab) => (
        <div key={tab.label} className="flex items-start gap-3 border border-accent/35 bg-accent/[0.04] px-3.5 py-2.5">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center border border-accent/40 bg-accent/10 text-accent">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[12.5px] font-semibold text-white">{tab.label}</span>
              <span className="inline-flex items-center gap-1 border border-accent/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-accent-soft">
                Main tab
              </span>
            </div>
            <p className="mt-0.5 text-[12px] text-dim">{tab.description}</p>
          </div>
        </div>
      ))}

      {module.panel && (
        <div className="flex items-start gap-3 border border-accent/35 bg-accent/[0.04] px-3.5 py-2.5">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center border border-accent/40 bg-accent/10 text-accent">
            <KindIcon name={module.panel.icon} className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[12.5px] font-semibold text-white">{module.panel.label}</span>
              <span className="inline-flex items-center gap-1 border border-accent/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-accent-soft">
                <PanelRight className="h-2.5 w-2.5" />
                Panel tab
              </span>
            </div>
            <p className="mt-0.5 text-[12px] text-dim">
              Adds a dedicated <span className="font-mono text-white/85">{module.panel.label}</span> tab in the side panel.
            </p>
          </div>
        </div>
      )}

      {module.pages.length > 0 && (
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {module.pages.map((p) => {
            const badges = pageBadges(p)
            const partKeys = Object.keys(p.parts ?? {})
            return (
              <div key={p.type} className="flex flex-col gap-2 border border-line/45 bg-black/25 p-3">
                <div className="flex items-start gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-line/60 bg-white/[0.03] text-accent">
                    <KindIcon name={p.icon} className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-[12.5px] font-semibold text-white">{p.label}</span>
                      {p.plural && p.plural !== p.label && (
                        <span className="font-mono text-[11px] text-faint">({p.plural})</span>
                      )}
                      <span className="ml-auto border border-line/50 px-1.5 py-0.5 font-mono text-[10px] text-accent-soft">
                        {module.id}:{p.type}
                      </span>
                    </div>
                    {p.description && <p className="mt-1 text-[12px] text-dim">{p.description}</p>}
                  </div>
                </div>
                {(badges.length > 0 || partKeys.length > 0 || p.actions.length > 0) && (
                  <div className="flex flex-wrap gap-1 border-t border-line/30 pt-2 font-mono text-[10px]">
                    {badges.map((b) => (
                      <span key={b} className="border border-line/40 bg-white/[0.03] px-1.5 py-0.5 text-white/75">
                        {b}
                      </span>
                    ))}
                    {partKeys.map((part) => (
                      <span key={part} className="border border-accent/30 bg-accent/[0.05] px-1.5 py-0.5 text-accent-soft">
                        #{part}
                      </span>
                    ))}
                    {p.actions.map((act) => (
                      <span key={act} className="border border-accent/40 px-1.5 py-0.5 text-accent">
                        {act}()
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {groups.length > 0 && (
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {groups.map((g) => {
            const meta = metaForCategory(g.label)
            const Icon = meta.icon
            return (
              <div key={g.label} className="flex flex-col gap-2 border border-line/45 bg-black/25 p-3">
                <div className="flex items-start gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center border border-accent/35 bg-accent/10 text-accent-soft">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-soft">
                        {g.label}
                      </span>
                      <span className="font-mono text-[10.5px] text-faint">{g.items.length}</span>
                    </div>
                    <p className="mt-0.5 text-[11.5px] text-dim">{meta.hint}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {g.items.map((item) => (
                    <span
                      key={item}
                      className="border border-line/50 bg-white/[0.03] px-2 py-0.5 font-mono text-[11px] text-white/90"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
