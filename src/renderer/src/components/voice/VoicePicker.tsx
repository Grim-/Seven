import { useState } from 'react'
import { Play, Square } from 'lucide-react'
import type { VoiceRef } from '@shared/types'
import { Button, Modal, Select, Slider } from '../ui'
import { speak, stopSpeaking, usePiperVoices, useSpeech, useSystemVoices } from '../../lib/speech'

const SAMPLE = 'The lanterns are lit, and the road ahead is quiet. Shall we go?'

export function VoicePicker({ value, onChange, inherit }: { value: VoiceRef | null; onChange: (v: VoiceRef | null) => void; inherit: string }) {
  const system = useSystemVoices()
  const piper = usePiperVoices()
  const speaking = useSpeech((s) => s.speaking === 'voice-test')
  const options = [
    { value: '', label: inherit },
    ...piper.map((v) => ({ value: `piper:${v.name}`, label: `Piper · ${v.name}` })),
    ...system.map((v) => ({ value: `system:${v.voiceURI}`, label: `${v.name}${v.lang ? ` (${v.lang})` : ''}` }))
  ]
  if (value && !options.some((o) => o.value === value.id)) options.push({ value: value.id, label: `${value.id.replace(/^\w+:/, '')} (not found)` })
  const set = (patch: Partial<VoiceRef>) => value && onChange({ ...value, ...patch })
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Select value={value?.id ?? ''} options={options} onChange={(id) => onChange(id ? { id, rate: value?.rate ?? 1, pitch: value?.pitch ?? 1 } : null)} />
        <Button variant="ghost" icon={speaking ? <Square /> : <Play />} onClick={() => (speaking ? stopSpeaking() : void speak(SAMPLE, value, 'voice-test'))}>
          {speaking ? 'Stop' : 'Test'}
        </Button>
      </div>
      {value && (
        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center gap-2 text-[12px] text-dim">
            Speed
            <Slider value={Math.round(value.rate * 100)} min={50} max={200} step={5} onChange={(v) => set({ rate: v / 100 })} />
            <span className="w-10 font-mono text-white">{value.rate.toFixed(2)}</span>
          </label>
          {value.id.startsWith('system:') && (
            <label className="flex items-center gap-2 text-[12px] text-dim">
              Pitch
              <Slider value={Math.round(value.pitch * 100)} min={50} max={200} step={5} onChange={(v) => set({ pitch: v / 100 })} />
              <span className="w-10 font-mono text-white">{value.pitch.toFixed(2)}</span>
            </label>
          )}
        </div>
      )}
    </div>
  )
}

export function VoiceModal({ title, value, onSave, onClose }: { title: string; value: VoiceRef | null; onSave: (v: VoiceRef | null) => void; onClose: () => void }) {
  const [voice, setVoice] = useState<VoiceRef | null>(value)
  return (
    <Modal
      open
      title={title}
      onClose={onClose}
      footer={
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <VoicePicker
        value={voice}
        onChange={(v) => {
          setVoice(v)
          onSave(v)
        }}
        inherit="Default voice"
      />
    </Modal>
  )
}
