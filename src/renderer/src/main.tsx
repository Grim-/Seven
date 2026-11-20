import './index.css'
import './transport/electron'
import './transport/remote'
import { startTransport } from './lib/transport'
import { startFormWatch } from './lib/form'
import { watchWindowErrors } from './store/problems'

document.documentElement.dataset.mode = 'app'

startTransport()
watchWindowErrors()
startFormWatch()
void import('./start')
