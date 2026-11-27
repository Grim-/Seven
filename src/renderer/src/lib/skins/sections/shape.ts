import type { LookShadow } from '@shared/themeLook'
import { present, registerSkinSection } from './registry'

const px = (n: number | undefined) => (n === undefined ? undefined : `${n}px`)

function shade(strength: number): string {
  return `color-mix(in srgb, var(--color-shade) ${Math.round(strength * 100)}%, transparent)`
}

function shadow(s: LookShadow | undefined): string | undefined {
  return s ? `0 ${s.y}px ${s.blur}px ${shade(s.strength)}, inset 0 0 ${s.inset}px ${shade(s.strength)}` : undefined
}

function readShadow(value: string): LookShadow | undefined {
  const m = value.match(/^0 ([\d.]+)px ([\d.]+)px color-mix\([^,]+, [^ ]+ ([\d.]+)%.*inset 0 0 ([\d.]+)px/)
  return m ? { y: Number(m[1]), blur: Number(m[2]), strength: Number(m[3]) / 100, inset: Number(m[4]) } : undefined
}

registerSkinSection({
  vars: (theme) =>
    present({
      '--notch': px(theme.shape.notch),
      '--notch-sm': px(theme.shape.notchSm),
      '--radius-panel': px(theme.shape.radiusPanel),
      '--radius-control': px(theme.shape.radiusControl),
      '--panel-blur': px(theme.shape.blur),
      '--glow': theme.shape.glow === undefined ? undefined : String(theme.shape.glow),
      '--solidity': theme.shape.solidity === undefined ? undefined : String(theme.shape.solidity),
      '--shadow-panel': shadow(theme.shape.shadow)
    }),
  read: (read) => ({
    shape: {
      shadow: readShadow(read.value('--shadow-panel')),
      notch: read.number('--notch'),
      notchSm: read.number('--notch-sm'),
      radiusPanel: read.number('--radius-panel'),
      radiusControl: read.number('--radius-control'),
      blur: read.number('--panel-blur'),
      glow: read.number('--glow'),
      solidity: read.number('--solidity')
    }
  })
})
