import type { ReactNode } from 'react'
import { useState } from 'react'
import { Modal } from './Drawer'
import { Button } from './Button'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  children: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'primary'
  confirmLoading?: boolean
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  confirmLoading = false,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false)
  const loading = confirmLoading || busy

  const handleConfirm = async () => {
    setBusy(true)
    try {
      await onConfirm()
      onClose()
    } catch {
      // Keep dialog open on failure — caller should toast the error.
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => { if (!loading) onClose() }}
      title={title}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>{cancelLabel}</Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            loading={loading}
            disabled={loading}
            onClick={() => void handleConfirm()}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  )
}
