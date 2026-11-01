import { useEffect } from 'react'
import { useAgents } from '../store/agents'
import { useApp } from '../store/app'

export function KindsView() {
  useEffect(() => {
    useAgents.setState({ kindAccess: true })
    useApp.getState().setView('agents')
  }, [])
  return null
}
