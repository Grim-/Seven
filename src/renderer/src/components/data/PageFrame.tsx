import type { AssetMeta } from '@shared/types'
import { Select, Toggle } from '../ui'
import { engine } from '../../lib/ipc'
import { toast } from '../../store/toasts'
import { useDashboards } from '../../store/dashboards'
import { cn } from '../../lib/cn'
import { failed } from '../../lib/notify'

export function isPage(asset: AssetMeta): boolean {
  return asset.mime === 'text/html'
}

export function PageFrame({ asset, className }: { asset: AssetMeta; className?: string }) {
  return (
    <iframe
      key={`${asset.id}:${asset.network ? 1 : 0}`}
      src={`seven-widget://asset/${asset.id}?n=${asset.network ? 1 : 0}`}
      title={asset.name}
      sandbox="allow-scripts allow-forms"
      referrerPolicy="no-referrer"
      className={cn('w-full border-0 bg-transparent', className)}
    />
  )
}

export function PageControls({ asset, boards = true }: { asset: AssetMeta; boards?: boolean }) {
  const dashboards = useDashboards((s) => s.list)
  const setNetwork = (on: boolean) =>
    void engine('data.assets.setNetwork', { id: asset.id, on }).catch(failed('Could not change'))
  const place = (dashboardId: string) => {
    if (!dashboardId) return
    engine('widgets.place', { dashboardId, things: [`file/${asset.id}`], at: null })
      .then((d) => toast.success('Put on board', d.name))
      .catch(failed('Could not add'))
  }
  return (
    <div className="flex items-center gap-3">
      <span title="Off: only scripts and fonts from cdnjs, jsdelivr, unpkg and Google Fonts load. On: the page can reach any site.">
        <Toggle checked={asset.network === true} onChange={setNetwork} label={asset.network ? 'Network on' : 'Network off'} />
      </span>
      {boards && dashboards.length > 0 && (
        <div className="w-44">
          <Select
            value=""
            options={[{ value: '', label: 'Put on board…' }, ...dashboards.map((d) => ({ value: d.id, label: d.name }))]}
            onChange={place}
            className="h-7 text-[12px]"
          />
        </div>
      )}
    </div>
  )
}
