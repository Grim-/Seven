import { useState } from 'react'
import { useInstallHelper } from './useInstallHelper'
import { HelperCard } from './HelperCard'
import { VersionList } from './VersionList'
import { HelperSettings } from './HelperSettings'
import { InstallWizard } from './wizard/InstallWizard'

export function HelperPanels({ id }: { id: string }) {
  const { state, progress } = useInstallHelper(id)
  const [installing, setInstalling] = useState(false)
  if (!state) return null
  return (
    <>
      <HelperCard state={state} onInstall={() => setInstalling(true)} />
      <VersionList state={state} />
      <HelperSettings state={state} />
      <InstallWizard state={state} progress={progress} open={installing} onClose={() => setInstalling(false)} />
    </>
  )
}
