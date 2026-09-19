import { useState } from 'react'
import { ClipboardList } from 'lucide-react'
import type { SeatRequest } from '../../api/platformApi'
import { ApiError } from '../../api/client'
import { organisationApi } from '../../api/organisationApi'
import { formatInrCents, seatRequestStatusLabel } from '../../lib/platformLabels'
import { formatDateTime } from '../../lib/utils'
import { useToast } from '../../hooks/useToast'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { cn } from '../../lib/utils'

function statusVariant(status: string): 'default' | 'success' | 'warning' | 'info' | 'danger' {
  switch (status) {
    case 'approved':
      return 'success'
    case 'paid':
      return 'info'
    case 'pending_payment':
      return 'warning'
    case 'rejected':
      return 'danger'
    default:
      return 'default'
  }
}

export function SettingsSeatRequestsCard({
  requests,
  loading,
  canRequest,
  onChanged,
}: {
  requests: SeatRequest[]
  loading: boolean
  canRequest: boolean
  onChanged: () => void
}) {
  const toast = useToast()
  const [cancellingId, setCancellingId] = useState<number | null>(null)

  const cancel = async (id: number) => {
    setCancellingId(id)
    try {
      await organisationApi.cancelSeatRequest(id)
      toast.success('Request cancelled')
      onChanged()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not cancel request')
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <article
      className={cn(
        'overflow-hidden rounded-xl border border-gray-200 bg-card shadow-[var(--shadow-card)]',
        'dark:border-gray-700',
      )}
    >
      <div className="border-b border-gray-200/90 px-6 py-4 sm:px-7 dark:border-gray-700/80">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 shrink-0 text-muted" aria-hidden />
          <h2 className="text-lg font-semibold tracking-tight text-heading">Your requests</h2>
        </div>
      </div>

      <div className="p-6 sm:p-7">
        {loading ? (
          <p className="text-sm text-muted">Loading requests…</p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-muted">No seat requests yet.</p>
        ) : (
          <ul className="space-y-2">
            {requests.map(req => (
              <li
                key={req.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gray-50 dark:bg-gray-800/40 px-3 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <span className="tabular-nums font-medium text-heading">{req.requested_seats}</span>
                  <span className="text-muted"> seat{req.requested_seats === 1 ? '' : 's'} · </span>
                  <span className="tabular-nums text-muted">{formatInrCents(req.amount_cents)}</span>
                  <span className="text-xs text-muted ml-2">{formatDateTime(req.created_at)}</span>
                  {req.admin_note?.trim() && (req.status === 'approved' || req.status === 'rejected') && (
                    <p className="text-xs text-muted mt-1">
                      <span className="font-medium text-heading">Tradeal:</span> {req.admin_note.trim()}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={statusVariant(req.status)} className="capitalize">
                    {seatRequestStatusLabel(req.status, 'org')}
                  </Badge>
                  {canRequest && req.status === 'pending_payment' && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={cancellingId === req.id}
                      onClick={() => void cancel(req.id)}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  )
}
