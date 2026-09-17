import type { ReactNode } from 'react'
import { useState } from 'react'
import { Modal } from './Drawer'
import { Button } from './Button'
import { SwipeToConfirm } from './SwipeToConfirm'

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
  slideLabel?: string
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
  slideLabel,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false)
  const loading = confirmLoading || busy
  const destructive = variant === 'danger'

  const handleConfirm = async () => {
    setBusy(true)
    try {
      await onConfirm()
      onClose()
    } catch (err) {
      throw err
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => { if (!loading) onClose() }}
      title={title}
      footerClassName={
        destructive
          ? 'flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center'
          : undefined
      }
      footer={
        destructive ? (
          <>
            <Button variant="outline" onClick={onClose} disabled={loading} className="sm:shrink-0">
              {cancelLabel}
            </Button>
            <div className="min-w-0 flex-1">
              <SwipeToConfirm
                key={open ? 'open' : 'closed'}
                label={slideLabel ?? 'Slide to delete'}
                onConfirm={() => void handleConfirm()}
                disabled={loading}
                loading={loading}
              />
            </div>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={onClose} disabled={loading}>{cancelLabel}</Button>
            <Button
              variant="primary"
              loading={loading}
              disabled={loading}
              onClick={() => void handleConfirm()}
            >
              {confirmLabel}
            </Button>
          </>
        )
      }
    >
      {children}
    </Modal>
  )
}
