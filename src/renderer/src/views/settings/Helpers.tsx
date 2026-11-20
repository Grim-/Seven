import { useEffect } from 'react'
import { Segmented, SettingCard, SettingRow, StatusBadge } from '../../components/ui'
import { HelperPanels } from '../../components/install/HelperPanels'
import { useInstallHelper } from '../../components/install/useInstallHelper'
import { engine } from '../../lib/ipc'
import { useLive } from '../../lib/useLive'
import { useViewPlace } from '../../lib/viewPlace'

const FALLBACK_HELPERS = [
  { id: 'llama-server', title: 'llama-server', about: 'Runs local text and chat models on your machine.' },
  { id: 'sd-server', title: 'sd-server', about: 'Runs local image generation models on your machine.' }
]

function HelperOverviewRow({
  id,
  title,
  about,
  selected,
  onSelect
}: {
  id: string
  title: string
  about: string
  selected: boolean
  onSelect: () => void
}) {
  const { state } = useInstallHelper(id)
  const active = state?.versions.find((v) => v.id === state.active) ?? null
  return (
    <SettingRow
      label={title}
      hint={state?.root ? `${about} Folder: ${state.root}` : about}
      aside={
        <div className="flex items-center gap-1.5">
          {state?.update && <StatusBadge tone="warn">{state.update.tag} out</StatusBadge>}
          <StatusBadge tone={active ? 'ok' : 'idle'}>{active ? active.label : 'Not installed'}</StatusBadge>
        </div>
      }
    >
      <button
        type="button"
        onClick={onSelect}
        className={selected ? 'border border-accent bg-accent/15 px-2.5 py-1 font-mono text-[11px] text-accent' : 'border border-line px-2.5 py-1 font-mono text-[11px] text-dim hover:border-line-hover hover:text-white'}
      >
        {selected ? 'Selected' : 'Manage'}
      </button>
    </SettingRow>
  )
}

export function Helpers() {
  const listed = useLive(() => engine('install.helpers'), 'install.changed')
  const helpers = listed && listed.length > 0 ? listed : FALLBACK_HELPERS
  const [selected, setSelected] = useViewPlace('settings.helpers.id', helpers[0]?.id ?? 'llama-server')

  useEffect(() => {
    if (helpers.length > 0 && !helpers.some((h) => h.id === selected)) {
      setSelected(helpers[0].id)
    }
  }, [helpers, selected])

  const activeHelper = helpers.find((h) => h.id === selected) ?? helpers[0]
  const activeId = activeHelper?.id ?? 'llama-server'

  return (
    <>
      <SettingCard
        title="Helper installers"
        intro={activeHelper?.about}
        actions={<Segmented value={activeId} options={helpers.map((h) => ({ value: h.id, label: h.title }))} onChange={setSelected} />}
      >
        {helpers.map((h) => (
          <HelperOverviewRow key={h.id} id={h.id} title={h.title} about={h.about} selected={h.id === activeId} onSelect={() => setSelected(h.id)} />
        ))}
      </SettingCard>
      <HelperPanels key={activeId} id={activeId} />
    </>
  )
}
