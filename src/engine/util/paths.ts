import os from 'node:os'
import path from 'node:path'

export const dataRoot = process.env.SEVEN_HOME || path.join(os.homedir(), '.seven')

export const paths = {
  root: dataRoot,
  models: path.join(dataRoot, 'models.json'),
  agents: path.join(dataRoot, 'agents'),
  sessions: path.join(dataRoot, 'sessions'),
  data: path.join(dataRoot, 'data')
}
