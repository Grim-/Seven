import { useEffect, useState } from 'react'
import { installRunning, versionFolder, type InstallChoice, type InstallHelperState, type InstallProgress } from '@shared/types'
import { Button, Modal, StepBar } from '../../ui'
import { engine } from '../../../lib/ipc'
import { failed } from '../../../lib/notify'
import { ReleaseStep } from './ReleaseStep'
import { FolderStep } from './FolderStep'
import { ReviewStep } from './ReviewStep'
import { ProgressStep } from './ProgressStep'

const STEPS = ['About', 'Version', 'Folder', 'Review', 'Install']

export function InstallWizard({ state, progress, open, onClose }: { state: InstallHelperState; progress: InstallProgress | null; open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0)
  const [tag, setTag] = useState('')
  const [build, setBuild] = useState('')
  const [root, setRoot] = useState(state.root)
  const [choice, setChoice] = useState<InstallChoice | null>(null)
  const [started, setStarted] = useState(false)
  const running = installRunning(progress)

  useEffect(() => {
    if (!open) return
    setStep(running ? STEPS.length - 1 : 0)
    setStarted(running)
    setRoot(state.root)
    if (!state.releases.length) void engine('install.check', { helper: state.id }).catch(failed('Could not check for releases'))
  }, [open])

  useEffect(() => {
    setChoice(null)
    if (!tag || !build) return
    let live = true
    void engine('install.choices', { helper: state.id, tag }).then((list) => live && setChoice(list.find((c) => c.build === build) ?? null))
    return () => {
      live = false
    }
  }, [state.id, tag, build])

  const pickTag = (next: string) => {
    setTag(next)
    setBuild('')
  }
  const start = () => {
    setStarted(true)
    setStep(STEPS.length - 1)
    void engine('install.start', { helper: state.id, tag, build, root }).catch(() => undefined)
  }
  const canNext = [true, Boolean(choice && !choice.unavailable), Boolean(root), true][step] ?? false
  const footer = (
    <>
      {step === STEPS.length - 1 ? (
        running ? (
          <Button variant="danger" onClick={() => void engine('install.cancel', { helper: state.id })}>
            Cancel install
          </Button>
        ) : (
          <Button variant="primary" onClick={onClose}>
            Close
          </Button>
        )
      ) : (
        <>
          <Button variant="ghost" onClick={step === 0 ? onClose : () => setStep(step - 1)}>
            {step === 0 ? 'Close' : 'Back'}
          </Button>
          {step === STEPS.length - 2 ? (
            <Button variant="primary" disabled={running || !choice} onClick={start}>
              Install
            </Button>
          ) : (
            <Button variant="primary" disabled={!canNext} onClick={() => setStep(step + 1)}>
              Next
            </Button>
          )}
        </>
      )}
    </>
  )
  return (
    <Modal open={open} title={`Install ${state.title}`} onClose={onClose} footer={footer} wide bodyClassName="flex min-h-0 flex-col gap-4 overflow-y-auto p-4">
      <StepBar steps={STEPS} current={step} />
      {step === 0 && (
        <div className="flex flex-col gap-2 text-[13px] leading-relaxed">
          <p>{state.about}</p>
          <p className="text-white/70">Releases come from {state.source}. You pick the release, the build and the folder; nothing is downloaded until you press Install.</p>
        </div>
      )}
      {step === 1 && <ReleaseStep state={state} tag={tag} build={build} onTag={pickTag} onBuild={setBuild} />}
      {step === 2 && <FolderStep root={root} defaultRoot={state.defaultRoot} onRoot={setRoot} />}
      {step === 3 && choice && <ReviewStep tag={tag} choice={choice} root={root} folder={versionFolder(tag, build)} source={state.source} />}
      {step === 4 && (started || progress) && <ProgressStep state={state} progress={progress} />}
    </Modal>
  )
}
