import { closePlay, showPlay } from '../playStore'
import { TravelPanel } from '../TravelPanel'
import { registerViewAct } from './registry'

registerViewAct('change_world', (data, { title, token }) => {
  const sheet = token?.visitor.sheet
  if (!sheet) return
  showPlay(title, <TravelPanel world={String(data.world ?? '')} map={String(data.map ?? '')} place="" sheet={sheet} onDone={closePlay} />)
})
