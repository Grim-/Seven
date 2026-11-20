import { Aperture, Eye, ImagePlus, Link, PanelRight, Plus, UserRound, X } from 'lucide-react'
import { linkFor } from '@shared/text'
import { Button, InlineTitle, SaveState, type SaveStatus } from '../../ui'
import { AssetMedia } from '../../pictures/AssetMedia'
import { showInPanel } from '../showInPanel'
import { copyText } from '../../../lib/notify'

export function SheetHeader({ id, title, image, fields, wornBy, status, error, previewing, onRename, onPortrait, onClearPortrait, onGeneratePortrait, onAddField, onPreview }: { id: string; title: string; image: string | null; fields: number; wornBy: string[]; status: SaveStatus; error: string | null; previewing: boolean; onRename: (title: string) => void; onPortrait: () => void; onClearPortrait?: () => void; onGeneratePortrait?: () => void; onAddField: () => void; onPreview: () => void }) {
  const link = linkFor('sheet', id)
  return (
    <div className="flex flex-wrap items-start gap-5 border-b border-line/50 bg-gradient-to-b from-accent/[0.06] to-transparent p-5">
      <div className="group/portrait relative h-40 w-40 shrink-0 overflow-hidden border border-line-strong bg-black/60">
        <button title={image ? 'Change portrait' : 'Add a portrait'} onClick={onPortrait} className="h-full w-full cursor-pointer">
          {image ? (
            <AssetMedia id={image} className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full flex-col items-center justify-center gap-2 text-faint group-hover/portrait:text-accent">
              <UserRound className="h-12 w-12" />
              <span className="font-mono text-[10px] uppercase tracking-[0.16em]">Add portrait</span>
            </span>
          )}
          {image && (
            <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/70 py-1 font-mono text-[10px] uppercase tracking-wider text-accent opacity-0 group-hover/portrait:opacity-100">
              <ImagePlus className="h-3 w-3" /> Change
            </span>
          )}
        </button>
        {image && onClearPortrait && (
          <button
            type="button"
            title="Clear portrait"
            onClick={(e) => {
              e.stopPropagation()
              onClearPortrait()
            }}
            className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center border border-line/60 bg-black/80 text-dim hover:border-alert hover:text-alert cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-accent-soft">Character</span>
        <InlineTitle value={title} onSave={onRename} className="text-[30px] font-bold leading-tight tracking-wide" />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-dim">
          <span>{fields} fields</span>
          <span>{wornBy.length ? `Worn by ${wornBy.join(', ')}` : 'No agent wears it yet (pick it under Character in an agent)'}</span>
          <SaveState status={status} error={error} />
        </div>
        <div className="mt-1 flex flex-wrap gap-2">
          <Button size="sm" variant="primary" icon={<Plus />} onClick={onAddField}>
            Add field
          </Button>
          {onGeneratePortrait && (
            <Button size="sm" variant="secondary" icon={<Aperture />} onClick={onGeneratePortrait}>
              Generate portrait
            </Button>
          )}
          {image && onClearPortrait && (
            <Button size="sm" variant="ghost" icon={<X />} onClick={onClearPortrait}>
              Clear portrait
            </Button>
          )}
          <Button size="sm" variant="ghost" icon={<Eye />} onClick={onPreview}>
            {previewing ? 'Back to the sheet' : 'As an agent reads it'}
          </Button>
          <Button size="sm" variant="ghost" icon={<Link />} onClick={() => void copyText(link, 'Link copied', link)}>
            Copy link
          </Button>
          <Button size="sm" variant="ghost" icon={<PanelRight />} onClick={() => void showInPanel(`sheet/${id}`)}>
            Show in chat panel
          </Button>
        </div>
      </div>
    </div>
  )
}
