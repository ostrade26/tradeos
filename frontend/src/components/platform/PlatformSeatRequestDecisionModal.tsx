import { useEffect, useState } from 'react'
import { Modal } from '../ui/Drawer'
import { Button } from '../ui/Button'
import type { SeatRequest } from '../../api/platformApi'
import { formatInrCents, seatTypeLabel } from '../../lib/platformLabels'

export type SeatRequestDecisionMode = 'approve' | 'reject'

export function PlatformSeatRequestDecisionModal({
  open,
  mode,
  request,
  loading,
  onClose,
  onSubmit,
}: {
  open: boolean
  mode: SeatRequestDecisionMode
  request: SeatRequest | null
  loading: boolean
  onClose: () => void
  onSubmit: (payload: { paymentReference: string; message: string }) => void
}) {
  const [paymentReference, setPaymentReference] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!open || !request) return
    setPaymentReference(request.payment_reference ?? '')
    setMessage('')
  }, [open, request])

  if (!request) return null

  const orgLabel = request.organisation_name ?? `Organisation #${request.organisation_id}`
  const isApprove = mode === 'approve'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isApprove ? 'Approve seat request' : 'Reject seat request'}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant={isApprove ? 'primary' : 'danger'}
            loading={loading}
            onClick={() => onSubmit({ paymentReference: paymentReference.trim(), message: message.trim() })}
          >
            {isApprove ? 'Approve' : 'Reject'}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-muted mb-4">
        {isApprove ? (
          <>
            Confirm payment for <span className="font-medium text-heading">{orgLabel}</span> — seats activate on
            approve.
          </>
        ) : (
          <>
            Reject the request from <span className="font-medium text-heading">{orgLabel}</span>. Message optional for
            their admin.
          </>
        )}
      </p>

      <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm rounded-md bg-gray-50 dark:bg-gray-800/40 px-3 py-2.5">
        <dt className="text-muted">Seats</dt>
        <dd className="font-medium text-heading tabular-nums text-right">{request.requested_seats}</dd>
        <dt className="text-muted">Type</dt>
        <dd className="text-heading text-right">{seatTypeLabel(request.seat_type ?? 'operator')}</dd>
        <dt className="text-muted">Amount</dt>
        <dd className="text-heading tabular-nums text-right">{formatInrCents(request.amount_cents)}</dd>
      </dl>

      {isApprove && (
        <label className="block text-xs font-medium text-muted mb-3">
          Payment reference (optional)
          <input
            type="text"
            value={paymentReference}
            onChange={e => setPaymentReference(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-200 dark:border-gray-600 bg-card px-3 py-2 text-sm"
            placeholder="UTR, invoice number, etc."
            autoComplete="off"
          />
        </label>
      )}

      <label className="block text-xs font-medium text-muted">
        Message to organisation {isApprove ? '(optional)' : ''}
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={3}
          className="mt-1 block w-full rounded-md border border-gray-200 dark:border-gray-600 bg-card px-3 py-2 text-sm"
          placeholder={
            isApprove
              ? 'e.g. Payment matched — seats are live. Assign them under Settings → Team.'
              : 'e.g. Payment not received on our records. Reply to billing@… with your UTR.'
          }
        />
      </label>
    </Modal>
  )
}
