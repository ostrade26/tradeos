import { useEffect, useRef } from 'react'
import { useApiHealth } from '../../hooks/useApiHealth'
import { useServiceIssue } from '../../hooks/ServiceIssueProvider'
import { connectivityIssue } from '../../lib/serviceIssue'
import { SERVICE_ISSUE_UI_ENABLED } from '../../lib/serviceIssueConfig'

/** Opens the service issue modal when periodic health checks fail (e.g. tradeal.in + offline API). */
export function ApiServiceIssueWatch() {
  const { online, checking, retry } = useApiHealth(SERVICE_ISSUE_UI_ENABLED)
  const { showIssue, clearIssue } = useServiceIssue()
  const wasOffline = useRef(false)
  const dismissedWhileDown = useRef(false)
  const failureStreak = useRef(0)
  /** Avoid modal on a single blip during cold start or deploy. */
  const FAILURES_BEFORE_MODAL = 2

  useEffect(() => {
    if (!SERVICE_ISSUE_UI_ENABLED) return
    if (online === false && !checking) {
      wasOffline.current = true
      failureStreak.current += 1
      if (failureStreak.current >= FAILURES_BEFORE_MODAL && !dismissedWhileDown.current) {
        showIssue({
          ...connectivityIssue(),
          requestPath: '/health',
          httpStatus: 0,
          technical: 'Periodic health check failed (consecutive probes)',
        })
      }
      return
    }
    if (online === true) {
      wasOffline.current = false
      dismissedWhileDown.current = false
      failureStreak.current = 0
      clearIssue()
    }
  }, [online, checking, showIssue, clearIssue])

  useEffect(() => {
    const onDismiss = () => {
      if (online === false) dismissedWhileDown.current = true
    }
    window.addEventListener('tradeal-service-issue-dismissed', onDismiss)
    return () => window.removeEventListener('tradeal-service-issue-dismissed', onDismiss)
  }, [online])

  useEffect(() => {
    const onOnline = () => void retry()
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [retry])

  return null
}
