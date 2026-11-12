import './index.css'
import './transport/electron'
import './transport/remote'
import { startTransport } from './lib/transport'
import { startFormWatch } from './lib/form'

startTransport()
startFormWatch()
void import('./start')
