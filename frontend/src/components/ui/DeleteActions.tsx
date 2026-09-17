import { useState, type ReactNode } from 'react'
import { Trash2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from './Button'
import { Modal } from './Drawer'
import { SwipeToConfirm } from './SwipeToConfirm'

export type DeleteCheck = { ok: boolean; reason?: string }

interface DeleteActionButtonProps {
  label: string
  check: DeleteCheck
  onDelete: () => void
  onBlocked: (reason: string) => void
  className?: string
}

export function DeleteActionButton({
  label,
  check,
  onDelete,
  onBlocked,
  className,
}: DeleteActionButtonProps) {
  const { ok, reason } = check
  return (
    <button
      type="button"
      title={ok ? `Delete ${label}` : reason}
      aria-label={ok ? `Delete ${label}` : `Cannot delete ${label}`}
      onClick={e => {
        e.stopPropagation()
        if (ok) onDelete()
        else onBlocked(reason ?? 'This item cannot be deleted.')
      }}
      className={cn(
        'p-1.5 rounded-lg transition-colors cursor-pointer',
        ok
          ? 'text-muted hover:text-danger hover:bg-red-50 dark:hover:bg-red-950/30'
          : 'text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-500',
        className,
      )}
    >
      <Trash2 className="h-4 w-4" />
    </button>
  )
}

interface BlockedDeleteModalProps {
  open: boolean
  onClose: () => void
  name: string
  reason: string
}

export function BlockedDeleteModal({ open, onClose, name, reason }: BlockedDeleteModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cannot delete"
      footer={<Button onClick={onClose}>OK</Button>}
    >
      <p className="text-sm text-gray-600 dark:text-gray-300">
        <span className="font-medium text-heading">{name}</span> cannot be removed. {reason}
      </p>
    </Modal>
  )
}

interface ConfirmDeleteModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  children: ReactNode
  error?: string
  confirmLabel?: string
}

export function ConfirmDeleteModal({
  open,
  onClose,
  onConfirm,
  title,
  children,
  error,
  confirmLabel: _confirmLabel = 'Delete',
}: ConfirmDeleteModalProps) {
  const [busy, setBusy] = useState(false)

  const handleConfirm = async () => {
    if (busy) return
    setBusy(true)
    try {
      await onConfirm()
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => { if (!busy) onClose() }}
      title={title}
      footerClassName="flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy} className="sm:shrink-0">
            Cancel
          </Button>
          <div className="min-w-0 flex-1">
            <SwipeToConfirm
              key={open ? 'open' : 'closed'}
              label="Slide to delete"
              onConfirm={() => void handleConfirm()}
              disabled={busy}
              loading={busy}
            />
          </div>
        </>
      }
    >
      {children}
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </Modal>
  )
}
