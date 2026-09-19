import { useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { isAssistantEnabled } from './flags'
import { setAssistantOpen } from './session'

/** True when Tradeal AI FAB / header / ⌘J should be available. */
export function useAssistantEnabled(): boolean {
  const { session, isPlatformAdmin } = useAuth()
  const enabled = isAssistantEnabled(session, isPlatformAdmin)

  useEffect(() => {
    if (!enabled) setAssistantOpen(false)
  }, [enabled])

  return enabled
}
