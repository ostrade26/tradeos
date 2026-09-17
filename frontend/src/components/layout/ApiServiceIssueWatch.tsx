import { useEffect, useRef } from 'react'
import { useApiHealth } from '../../hooks/useApiHealth'
import { useServiceIssue } from '../../hooks/ServiceIssueProvider'
import { connectivityIssue } from '../../lib/serviceIssue'

/** Opens the service issue modal when periodic health checks fail (e.g. tradeal.in + offline API). */
export function ApiServiceIssueWatch() {
  const { online, checking, retry } = useApiHealth()
  const { showIssue, clearIssue } = useServiceIssue()
  const wasOffline = useRef(false)
  const dismissedWhileDown = useRef(false)

  useEffect(() => {
    if (online === false && !checking) {
      wasOffline.current = true
      if (!dismissedWhileDown.current) {
        showIssue({
          ...connectivityIssue(),
          requestPath: '/health',
          httpStatus: 0,
          technical: 'Periodic health check failed',
        })
      }
      return
    }
    if (online === true) {
      wasOffline.current = false
      dismissedWhileDown.current = false
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
