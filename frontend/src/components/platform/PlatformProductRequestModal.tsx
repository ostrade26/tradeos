import { useEffect, useState } from 'react'
import { Modal } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'
import { Badge } from '../ui/Badge'
import type { ProductRequest, ProductRequestStatus } from '../../api/platformApi'
import { ScreenshotStrip } from '../feedback/ScreenshotStrip'
import { productRequestKindLabel, productRequestPriorityLabel, productRequestStatusLabel } from '../../lib/platformLabels'
import { isUsefulFeedbackPagePath } from '../../lib/feedbackPagePath'
import { formatDateTime } from '../../lib/utils'

export function PlatformProductRequestModal({
  open,
  onClose,
  request,
  loading,
  onSave,
}: {
  open: boolean
  onClose: () => void
  request: ProductRequest | null
  loading: boolean
  onSave: (body: { status: ProductRequestStatus; reply: string }) => void
}) {
  const [status, setStatus] = useState<ProductRequestStatus>('received')
  const [reply, setReply] = useState('')

  useEffect(() => {
    if (!open || !request) return
    setStatus((request.status as ProductRequestStatus) || 'received')
    setReply(request.reply || '')
  }, [open, request])

  if (!request) return null

  const closed = request.status === 'done'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={productRequestKindLabel(request.kind)}
      subtitle={`${productRequestPriorityLabel(request.priority || 'p3')} · ${request.organisation_name ?? `Org #${request.organisation_id}`} · ${request.requested_by_name || request.requested_by_username || 'User'}`}
      size="md"
      footer={
        closed ? (
          <div className="flex justify-end">
            <Button onClick={onClose}>Done</Button>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button loading={loading} disabled={loading} onClick={() => onSave({ status, reply })}>
              Save and notify
            </Button>
          </div>
        )
      }
      secondaryBody={
        closed ? undefined : (
          <div className="space-y-4">
            <Select
              label="Status"
              searchable={false}
              options={[
                { value: 'received', label: 'Received' },
                { value: 'in_progress', label: 'In progress' },
                { value: 'done', label: 'Done' },
              ]}
              value={status}
              onChange={e => setStatus(e.target.value as ProductRequestStatus)}
            />
            <p className="text-xs leading-relaxed text-muted">
              New issues stay in your inbox until you reply or change status. Saving with a reply moves the request to{' '}
              <span className="font-medium text-heading">In progress</span>. Choose{' '}
              <span className="font-medium text-heading">Done</span> when it is fully resolved.
            </p>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Reply to requester</span>
              <textarea
                value={reply}
                onChange={e => setReply(e.target.value)}
                rows={4}
                maxLength={2000}
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-heading placeholder:text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 dark:border-gray-600 dark:bg-card"
                placeholder="Optional. They see this in notifications."
              />
            </label>
          </div>
        )
      }
    >
      <div>
        {closed ? (
          <Badge variant="success">{productRequestStatusLabel(request.status)}</Badge>
        ) : null}
        <p className={closed ? 'mt-3 text-sm text-heading whitespace-pre-wrap leading-relaxed' : 'text-sm text-heading whitespace-pre-wrap leading-relaxed'}>
          {request.message}
        </p>
        <ScreenshotStrip shots={request.attachments} />
        <p className="mt-1.5 text-xs tabular-nums text-muted">{formatDateTime(request.created_at)}</p>
        {isUsefulFeedbackPagePath(request.page_path) ? (
          <p className="mt-1.5 text-xs font-mono text-muted break-all">{request.page_path}</p>
        ) : null}
        {closed && request.reply ? (
          <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Reply sent</p>
            <p className="mt-2 text-sm leading-relaxed text-heading whitespace-pre-wrap">{request.reply}</p>
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
