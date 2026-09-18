import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '../ui/Button'
import { DataTable, TableSkeleton } from '../ui/DataTable'
import { EmptyState } from '../ui/Tabs'
import { ApiError } from '../../api/client'
import { platformApi, type FeatureInterest } from '../../api/platformApi'
import { useToast } from '../../hooks/useToast'
import { formatDateTime } from '../../lib/utils'
import { INBOX_REFRESH_EVENT } from '../../hooks/useMeInbox'
import {
  PlatformFeatureInterestModal,
  type FeatureInterestRow,
} from './PlatformFeatureInterestModal'

export type PlatformFeatureAccessPanelHandle = {
  refresh: () => Promise<void>
}

export const PlatformFeatureAccessPanel = forwardRef<
  PlatformFeatureAccessPanelHandle,
  { onOpenCountChange?: (open: number) => void }
>(function PlatformFeatureAccessPanel({ onOpenCountChange }, ref) {
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [interests, setInterests] = useState<FeatureInterest[]>([])
  const [loading, setLoading] = useState(false)
  const [reviewing, setReviewing] = useState<FeatureInterestRow | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await platformApi.listFeatureInterests()
      setInterests(res.interests)
      const open = res.interests.filter(i => i.status === 'interested').length
      onOpenCountChange?.(open)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not load feature requests')
    } finally {
      setLoading(false)
    }
  }, [onOpenCountChange, toast])

  useEffect(() => {
    void load()
  }, [load])

  useImperativeHandle(ref, () => ({ refresh: load }), [load])

  const interestIdParam = searchParams.get('interestId')
  useEffect(() => {
    if (!interestIdParam || interests.length === 0) return
    const id = Number(interestIdParam)
    if (!Number.isFinite(id)) return
    const row = interests.find(i => i.id === id)
    if (row) setReviewing(row as FeatureInterestRow)
  }, [interestIdParam, interests])

  const clearInterestIdParam = () => {
    if (!searchParams.has('interestId')) return
    const next = new URLSearchParams(searchParams)
    next.delete('interestId')
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="space-y-4">
      {loading && interests.length === 0 ? (
        <TableSkeleton rows={8} cols={5} />
      ) : (
        <DataTable
          data={interests}
          columns={[
            {
              key: 'org',
              header: 'Organisation',
              render: r => r.organisation_name ?? `#${r.organisation_id}`,
            },
            {
              key: 'feature',
              header: 'Feature',
              render: r => (
                <div>
                  <p className="font-medium text-heading">{r.feature_title}</p>
                  <p className="text-xs text-muted font-mono">{r.feature_key}</p>
                </div>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              render: r =>
                r.status === 'interested'
                  ? 'Pending'
                  : r.status === 'approved'
                    ? 'Active'
                    : r.status === 'rejected'
                      ? 'Declined'
                      : r.status.replace(/_/g, ' '),
            },
            {
              key: 'created',
              header: 'Requested',
              render: r => formatDateTime(r.created_at),
            },
            {
              key: 'actions',
              header: '',
              actionsWide: true,
              className: 'text-center',
              render: r => (
                <div className="flex justify-center">
                  <Button
                    type="button"
                    size="sm"
                    variant={r.status === 'interested' ? 'primary' : 'outline'}
                    className="whitespace-nowrap"
                    onClick={() => setReviewing(r as FeatureInterestRow)}
                  >
                    {r.status === 'interested' ? 'Review' : 'Change'}
                  </Button>
                </div>
              ),
            },
          ]}
          getRowId={r => String(r.id)}
          defaultPageSize={25}
          emptyState={
            <EmptyState
              title="No feature access requests"
              description="Organisations request access from launch notices and Features."
            />
          }
        />
      )}

      <PlatformFeatureInterestModal
        open={reviewing != null}
        interest={reviewing}
        loading={busy}
        onClose={() => {
          if (!busy) {
            setReviewing(null)
            clearInterestIdParam()
          }
        }}
        onApprove={async note => {
          if (!reviewing) return
          const wasRejected = reviewing.status === 'rejected'
          setBusy(true)
          try {
            await platformApi.approveFeatureInterest(reviewing.id, note)
            toast.success(
              wasRejected ? 'Access restored for organisation' : 'Feature enabled for organisation',
            )
            setReviewing(null)
            clearInterestIdParam()
            await load()
            window.dispatchEvent(new Event(INBOX_REFRESH_EVENT))
          } catch (err) {
            toast.error(err instanceof ApiError ? err.message : 'Could not approve')
          } finally {
            setBusy(false)
          }
        }}
        onReject={async note => {
          if (!reviewing) return
          const wasApproved = reviewing.status === 'approved'
          setBusy(true)
          try {
            await platformApi.rejectFeatureInterest(reviewing.id, note)
            toast.success(
              wasApproved
                ? 'Access revoked — organisation notified'
                : 'Request declined',
            )
            setReviewing(null)
            clearInterestIdParam()
            await load()
            window.dispatchEvent(new Event(INBOX_REFRESH_EVENT))
          } catch (err) {
            toast.error(err instanceof ApiError ? err.message : 'Could not decline')
          } finally {
            setBusy(false)
          }
        }}
      />
    </div>
  )
})
