import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useBlocker } from 'react-router'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'

interface UseUnsavedChangesGuardOptions {
  dirty: boolean
  enabled?: boolean
  title?: string
  message?: string
}

export function useUnsavedChangesGuard({
  dirty,
  enabled = true,
  title = 'Discard unsaved changes?',
  message = 'You have unsaved changes on this form. Leave without saving?',
}: UseUnsavedChangesGuardOptions) {
  const shouldBlock = enabled && dirty
  const blocker = useBlocker(useCallback(() => shouldBlock, [shouldBlock]))

  const [manualOpen, setManualOpen] = useState(false)
  const manualLeaveRef = useRef<(() => void) | null>(null)
  const leavingRef = useRef(false)

  useEffect(() => {
    if (shouldBlock || blocker.state !== 'blocked') return
    blocker.reset?.()
  }, [shouldBlock, blocker])

  useEffect(() => {
    if (!shouldBlock) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [shouldBlock])

  const requestLeave = useCallback((leave: () => void) => {
    if (!shouldBlock) {
      leave()
      return
    }
    manualLeaveRef.current = leave
    setManualOpen(true)
  }, [shouldBlock])

  const handleConfirmLeave = useCallback(() => {
    leavingRef.current = true
    setManualOpen(false)
    if (blocker.state === 'blocked') {
      blocker.proceed?.()
      return
    }
    const leave = manualLeaveRef.current
    manualLeaveRef.current = null
    leave?.()
  }, [blocker])

  const handleStay = useCallback(() => {
    if (leavingRef.current) {
      leavingRef.current = false
      return
    }
    if (blocker.state === 'blocked') blocker.reset?.()
    manualLeaveRef.current = null
    setManualOpen(false)
  }, [blocker])

  const dialogOpen = manualOpen || blocker.state === 'blocked'

  const dialog: ReactNode = (
    <ConfirmDialog
      open={dialogOpen}
      onClose={handleStay}
      onConfirm={handleConfirmLeave}
      title={title}
      confirmLabel="Leave without saving"
      cancelLabel="Stay on page"
      variant="danger"
    >
      <p className="text-sm text-muted leading-relaxed">{message}</p>
    </ConfirmDialog>
  )

  return { requestLeave, dialog }
}
