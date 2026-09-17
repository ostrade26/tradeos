import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '../components/ui/Drawer'
import { SystemUpdateModal } from '../components/layout/SystemUpdateModal'
import { PlatformProductRequestModal } from '../components/platform/PlatformProductRequestModal'
import {
  PlatformSeatRequestDecisionModal,
  type SeatRequestDecisionMode,
} from '../components/platform/PlatformSeatRequestDecisionModal'
import { useAuth } from './useAuth'
import { useToast } from './useToast'
import { platformApi } from '../api/platformApi'
import { ApiError } from '../api/client'
import { authApi } from '../api/tradeApi'
import { sessionFromApi } from '../lib/authSession'
import { saveAuthSession } from '../lib/auth'
import { appPath } from '../lib/appShellMode'
import { isProductUpdateNotice } from '../lib/notificationDisplay'
import type { ProductRequestStatus, UserNotification } from '../api/platformApi'
import type { UnifiedInboxItem } from '../lib/unifiedInbox'

export function useInboxItemActions({
  platformConsole,
  markRead,
  refresh,
  refreshPlatform,
}: {
  platformConsole: boolean
  markRead: (itemId: string) => Promise<void>
  refresh: () => Promise<void>
  refreshPlatform: () => Promise<void>
}) {
  const navigate = useNavigate()
  const { session } = useAuth()
  const toast = useToast()

  const [readNotice, setReadNotice] = useState<UserNotification | null>(null)
  const [updating, setUpdating] = useState<UserNotification | null>(null)
  const [reviewingRequest, setReviewingRequest] = useState<UnifiedInboxItem['productRequest']>()
  const [reviewingBusy, setReviewingBusy] = useState(false)
  const [seatDecision, setSeatDecision] = useState<{
    mode: SeatRequestDecisionMode
    row: NonNullable<UnifiedInboxItem['seatRequest']>
  } | null>(null)
  const [seatDecisionBusy, setSeatDecisionBusy] = useState(false)

  const applyNotice = useCallback(async (notificationId: number) => {
    const { organisationApi } = await import('../api/organisationApi')
    await organisationApi.applyNotificationUpdate(notificationId)
    if (session?.token) {
      const me = await authApi.me()
      saveAuthSession(sessionFromApi(me, session.token))
    }
    await refresh()
  }, [refresh, session?.token])

  const handleSelect = useCallback((row: UnifiedInboxItem) => {
    if (row.productRequest && platformConsole) {
      setReviewingRequest(row.productRequest)
      return
    }
    if (row.seatRequest && platformConsole) {
      setSeatDecision({ mode: 'approve', row: row.seatRequest })
      return
    }
    if (row.notice) {
      if (isProductUpdateNotice(row.notice) && !row.notice.applied && !row.notice.applied_at) {
        setUpdating(row.notice)
      } else {
        setReadNotice(row.notice)
      }
      if (row.category === 'notice' && row.unread) void markRead(row.id)
      return
    }
    if (row.href) {
      const path = row.href.startsWith('/app/') ? row.href : appPath(row.href)
      navigate(path)
    }
  }, [markRead, navigate, platformConsole])

  const saveProductReview = async (body: { status: ProductRequestStatus; reply: string }) => {
    if (!reviewingRequest) return
    setReviewingBusy(true)
    try {
      await platformApi.reviewProductRequest(reviewingRequest.id, body)
      toast.success('Requester notified')
      setReviewingRequest(undefined)
      await refreshPlatform()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save')
    } finally {
      setReviewingBusy(false)
    }
  }

  const submitSeatDecision = async ({
    paymentReference,
    message,
  }: {
    paymentReference: string
    message: string
  }) => {
    if (!seatDecision) return
    const { mode: decisionMode, row } = seatDecision
    setSeatDecisionBusy(true)
    try {
      if (decisionMode === 'approve') {
        const res = await platformApi.approveSeatRequest(row.id, {
          payment_reference: paymentReference,
          admin_note: message,
        })
        toast.success(
          `Approved · ${res.seats.available_seats} seat${res.seats.available_seats === 1 ? '' : 's'} available`,
        )
      } else {
        await platformApi.rejectSeatRequest(row.id, message)
        toast.success('Request rejected')
      }
      setSeatDecision(null)
      await refreshPlatform()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save')
    } finally {
      setSeatDecisionBusy(false)
    }
  }

  const modals = (
    <>
      <Modal
        open={readNotice != null}
        onClose={() => setReadNotice(null)}
        title={readNotice?.title ?? 'Message'}
        subtitle="From Tradeal"
        size="md"
      >
        <p className="text-sm text-heading whitespace-pre-wrap leading-relaxed">
          {readNotice?.body}
        </p>
      </Modal>

      <SystemUpdateModal
        open={!!updating}
        notification={updating}
        onClose={() => setUpdating(null)}
        onApply={applyNotice}
      />

      <PlatformProductRequestModal
        open={reviewingRequest != null}
        request={reviewingRequest ?? null}
        loading={reviewingBusy}
        onClose={() => !reviewingBusy && setReviewingRequest(undefined)}
        onSave={body => void saveProductReview(body)}
      />

      <PlatformSeatRequestDecisionModal
        open={seatDecision != null}
        mode={seatDecision?.mode ?? 'approve'}
        request={seatDecision?.row ?? null}
        loading={seatDecisionBusy}
        onClose={() => !seatDecisionBusy && setSeatDecision(null)}
        onSubmit={payload => void submitSeatDecision(payload)}
      />
    </>
  )

  return { handleSelect, modals }
}
