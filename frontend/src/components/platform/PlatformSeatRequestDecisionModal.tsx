import { useEffect, useState } from 'react'
import { Modal } from '../ui/Drawer'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import type { SeatRequest } from '../../api/platformApi'
import { formatInrCents, seatRequestStatusLabel, seatTypeLabel } from '../../lib/platformLabels'
import { isOpenSeatRequest, seatRequestStatusBadgeVariant } from '../../lib/platformSeatRequestInbox'
import { formatDateTime } from '../../lib/utils'

export type SeatRequestDecisionMode = 'approve' | 'reject' | 'view'

export function PlatformSeatRequestDecisionModal({
  open,
  mode,
  request,
  loading,
  viewAudience = 'platform',
  onClose,
  onSubmit,
}: {
  open: boolean
  mode: SeatRequestDecisionMode
  request: SeatRequest | null
  loading: boolean
  /** Who is reading a decided request in view mode */
  viewAudience?: 'org' | 'platform'
  onClose: () => void
  onSubmit: (payload: { paymentReference: string; message: string }) => void
}) {
  const [paymentReference, setPaymentReference] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!open || !request) return
    setPaymentReference(request.payment_reference ?? '')
    setMessage(mode === 'view' ? (request.admin_note ?? '') : '')
  }, [open, request, mode])

  if (!request) return null

  const orgLabel = request.organisation_name ?? `Organisation #${request.organisation_id}`
  const isApprove = mode === 'approve'
  const isView = mode === 'view' || !isOpenSeatRequest(request.status)
  const orgViewer = isView && viewAudience === 'org'
  const paymentRefOk = paymentReference.trim().length > 0
  const messageOk = message.trim().length > 0
  const canSubmit = isApprove ? paymentRefOk && messageOk : mode === 'reject'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        isView
          ? 'Seat request'
          : isApprove
            ? 'Approve seat request'
            : 'Reject seat request'
      }
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          {isView ? (
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button
                variant={isApprove ? 'primary' : 'danger'}
                loading={loading}
                disabled={!canSubmit}
                onClick={() =>
                  onSubmit({ paymentReference: paymentReference.trim(), message: message.trim() })
                }
              >
                {isApprove ? 'Approve' : 'Reject'}
              </Button>
            </>
          )}
        </div>
      }
    >
      <p className="text-sm text-muted mb-4">
        {isView ? (
          orgViewer ? (
            <>Your seat request has been decided — details below are read-only.</>
          ) : (
            <>
              Request from <span className="font-medium text-heading">{orgLabel}</span> — decided requests
              cannot be edited.
            </>
          )
        ) : isApprove ? (
          <>
            Confirm payment for <span className="font-medium text-heading">{orgLabel}</span> — seats activate on
            approve. Payment reference and message are required.
          </>
        ) : (
          <>
            Reject the request from <span className="font-medium text-heading">{orgLabel}</span>. Message optional for
            their admin.
          </>
        )}
      </p>

      <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm rounded-md bg-gray-50 dark:bg-gray-800/40 px-3 py-2.5">
        <dt className="text-muted">Status</dt>
        <dd className="flex justify-end">
          <Badge variant={seatRequestStatusBadgeVariant(request.status)} dot className="capitalize">
            {seatRequestStatusLabel(request.status, orgViewer ? 'org' : 'platform')}
          </Badge>
        </dd>
        <dt className="text-muted">Seats</dt>
        <dd className="font-medium text-heading tabular-nums text-right">{request.requested_seats}</dd>
        <dt className="text-muted">Type</dt>
        <dd className="text-heading text-right">{seatTypeLabel(request.seat_type ?? 'operator')}</dd>
        <dt className="text-muted">Amount</dt>
        <dd className="text-heading tabular-nums text-right">{formatInrCents(request.amount_cents)}</dd>
        {isView && request.approved_at ? (
          <>
            <dt className="text-muted">Decided</dt>
            <dd className="text-heading tabular-nums text-right">{formatDateTime(request.approved_at)}</dd>
          </>
        ) : null}
      </dl>

      {isView ? (
        <div className="space-y-3">
          {request.payment_reference?.trim() ? (
            <div>
              <p className="text-xs font-medium text-muted">Payment reference</p>
              <p className="mt-1 text-sm text-heading whitespace-pre-wrap">{request.payment_reference}</p>
            </div>
          ) : null}
          {request.admin_note?.trim() ? (
            <div>
              <p className="text-xs font-medium text-muted">
                {orgViewer ? 'Message from Tradeal' : 'Message to organisation'}
              </p>
              <p className="mt-1 text-sm text-heading whitespace-pre-wrap">{request.admin_note}</p>
            </div>
          ) : (
            <p className="text-sm text-muted">
              {orgViewer ? 'No message from Tradeal.' : 'No message was recorded.'}
            </p>
          )}
        </div>
      ) : (
        <>
          {isApprove && (
            <label className="block text-xs font-medium text-muted mb-3">
              Payment reference
              <input
                type="text"
                value={paymentReference}
                onChange={e => setPaymentReference(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-200 dark:border-gray-600 bg-card px-3 py-2 text-sm"
                placeholder="UTR, invoice number, etc."
                autoComplete="off"
                required
              />
            </label>
          )}

          <label className="block text-xs font-medium text-muted">
            Message to organisation {isApprove ? '' : '(optional)'}
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
              required={isApprove}
            />
          </label>
        </>
      )}
    </Modal>
  )
}
