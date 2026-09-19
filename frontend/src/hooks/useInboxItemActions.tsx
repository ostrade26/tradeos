import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '../components/ui/Drawer'
import { SystemUpdateModal } from '../components/layout/SystemUpdateModal'
import { ReleaseNoticeModal } from '../components/feedback/ReleaseNoticeModal'
import { PlatformProductRequestModal } from '../components/platform/PlatformProductRequestModal'
import {
  PlatformSeatRequestDecisionModal,
  type SeatRequestDecisionMode,
} from '../components/platform/PlatformSeatRequestDecisionModal'
import {
  PlatformFeatureInterestModal,
  type FeatureInterestRow,
} from '../components/platform/PlatformFeatureInterestModal'
import { useAuth } from './useAuth'
import { useToast } from './useToast'
import { platformApi } from '../api/platformApi'
import { ApiError } from '../api/client'
import { authApi } from '../api/tradeApi'
import { sessionFromApi } from '../lib/authSession'
import { saveAuthSession } from '../lib/auth'
import { appPath } from '../lib/appShellMode'
import {
  deployReviewHref,
  isDeployReviewItem,
} from '../lib/deployReviewNav'
import {
  isFeatureBrowseNotice,
  isFeatureDecisionNotice,
  isFeatureEnhancementNotice,
  isFeatureInterestNotice,
  isProductUpdateNotice,
  isReleaseStyleNoticeKind,
} from '../lib/notificationDisplay'
import { FeatureEnhancementModal } from '../components/feedback/FeatureEnhancementModal'
import { FeatureLaunchInterestModal } from '../components/feedback/FeatureLaunchInterestModal'
import type { ProductRequestStatus, UserNotification } from '../api/platformApi'
import type { UnifiedInboxItem } from '../lib/unifiedInbox'
import { INBOX_REFRESH_EVENT } from './useMeInbox'
import { isOpenSeatRequest, isSeatRequestDecisionItem } from '../lib/platformSeatRequestInbox'

function markFeatureInterestInboxNotices(
  items: UnifiedInboxItem[],
  interestId: string,
  markRead: (itemId: string) => Promise<void>,
) {
  for (const item of items) {
    const payloadId = item.notice?.payload?.feature_interest_id
    if (payloadId != null && String(payloadId) === interestId && item.unread) {
      void markRead(item.id)
    }
  }
}

export function useInboxItemActions({
  platformConsole,
  inboxItems,
  markRead,
  refresh,
  refreshPlatform,
}: {
  platformConsole: boolean
  inboxItems: UnifiedInboxItem[]
  markRead: (itemId: string) => Promise<void>
  refresh: () => Promise<void>
  refreshPlatform: () => Promise<void>
}) {
  const navigate = useNavigate()
  const { session } = useAuth()
  const toast = useToast()

  const [readNotice, setReadNotice] = useState<UserNotification | null>(null)
  const [updating, setUpdating] = useState<UserNotification | null>(null)
  const [featureOffer, setFeatureOffer] = useState<UserNotification | null>(null)
  const [featureOfferBusy, setFeatureOfferBusy] = useState(false)
  const [featureInterest, setFeatureInterest] = useState<UserNotification | null>(null)
  const [featureInterestBusy, setFeatureInterestBusy] = useState(false)
  const [reviewingRequest, setReviewingRequest] = useState<UnifiedInboxItem['productRequest']>()
  const [reviewingBusy, setReviewingBusy] = useState(false)
  const [reviewingInterest, setReviewingInterest] = useState<FeatureInterestRow | null>(null)
  const [interestReviewBusy, setInterestReviewBusy] = useState(false)
  const [seatDecision, setSeatDecision] = useState<{
    mode: SeatRequestDecisionMode
    row: NonNullable<UnifiedInboxItem['seatRequest']>
  } | null>(null)
  const [seatDecisionBusy, setSeatDecisionBusy] = useState(false)

  const applyNotice = useCallback(async (notificationId: number, featureKeys?: string[]) => {
    const { organisationApi } = await import('../api/organisationApi')
    await organisationApi.applyNotificationUpdate(notificationId, featureKeys)
    if (session?.token) {
      const me = await authApi.me()
      saveAuthSession(sessionFromApi(me, session.token))
    }
    await refresh()
  }, [refresh, session?.token])

  const openFeatureInterestReview = useCallback(async (interestIdRaw: string | number) => {
    const interestId = Number(interestIdRaw)
    if (!Number.isFinite(interestId)) {
      toast.error('Could not open request')
      return
    }
    markFeatureInterestInboxNotices(inboxItems, String(interestId), markRead)
    setInterestReviewBusy(true)
    try {
      const res = await platformApi.listFeatureInterests()
      const row = res.interests.find(i => i.id === interestId)
      if (!row) {
        toast.error('Request not found')
        return
      }
      setReviewingInterest(row as FeatureInterestRow)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not load request')
    } finally {
      setInterestReviewBusy(false)
    }
  }, [inboxItems, markRead, toast])

  const handleSelect = useCallback((row: UnifiedInboxItem) => {
    if (row.productRequest && platformConsole) {
      setReviewingRequest(row.productRequest)
      return
    }
    if (row.seatRequest) {
      const open = isOpenSeatRequest(row.seatRequest.status)
      if (platformConsole) {
        setSeatDecision({ mode: open ? 'approve' : 'view', row: row.seatRequest })
      } else if (!open || isSeatRequestDecisionItem(row)) {
        setSeatDecision({ mode: 'view', row: row.seatRequest })
      }
      if (row.category === 'notice' && row.unread) void markRead(row.id)
      return
    }
    if (isSeatRequestDecisionItem(row)) {
      toast.error('Could not load seat request details')
      if (row.category === 'notice' && row.unread) void markRead(row.id)
      return
    }
    if (isDeployReviewItem(row)) {
      const href = deployReviewHref(row)
      // Navigate first — awaiting markRead delayed the Releases refresh behind the inbox.
      navigate(href)
      if (row.category === 'notice' && row.unread) void markRead(row.id)
      return
    }
    if (row.notice) {
      if (isFeatureBrowseNotice(row.notice)) {
        navigate(row.notice.href || appPath('/features'))
        if (row.category === 'notice' && row.unread) void markRead(row.id)
        return
      }
      if (row.notice.payload?.cta === 'review_interest' && platformConsole) {
        const interestId = row.notice.payload?.feature_interest_id
        if (interestId) {
          void openFeatureInterestReview(interestId)
        } else {
          toast.error('Could not open request')
        }
        if (row.category === 'notice' && row.unread) void markRead(row.id)
        return
      }
      if (isFeatureInterestNotice(row.notice)) {
        setFeatureInterest(row.notice)
        if (row.category === 'notice' && row.unread) void markRead(row.id)
        return
      }
      if (isFeatureDecisionNotice(row.notice)) {
        setReadNotice(row.notice)
        if (row.notice.payload?.decision === 'approved' && session?.token) {
          void authApi.me().then(me => saveAuthSession(sessionFromApi(me, session.token!)))
        }
        if (row.category === 'notice' && row.unread) void markRead(row.id)
        return
      }
      if (
        isFeatureEnhancementNotice(row.notice) &&
        !row.notice.applied &&
        !row.notice.applied_at
      ) {
        setFeatureOffer(row.notice)
      } else if (isProductUpdateNotice(row.notice) && !row.notice.applied && !row.notice.applied_at) {
        setUpdating(row.notice)
      } else {
        setReadNotice(row.notice)
      }
      if (row.category === 'notice' && row.unread) void markRead(row.id)
      return
    }
    if (row.kind === 'feature_interest' && platformConsole) {
      const interestId = row.id.startsWith('feature-interest-')
        ? row.id.slice('feature-interest-'.length)
        : ''
      if (interestId) {
        void openFeatureInterestReview(interestId)
      } else {
        toast.error('Could not open request')
      }
      return
    }
    if (row.href) {
      const path =
        row.href.startsWith('/platform-admin') || row.href.startsWith('/app/')
          ? row.href
          : appPath(row.href)
      navigate(path)
      if (row.category === 'notice' && row.unread) void markRead(row.id)
    }
  }, [markRead, navigate, openFeatureInterestReview, platformConsole, session?.token, toast])

  const saveProductReview = async (body: { status: ProductRequestStatus; reply: string }) => {
    if (!reviewingRequest) return
    setReviewingBusy(true)
    try {
      await platformApi.reviewProductRequest(reviewingRequest.id, body)
      toast.success('Requester notified')
      setReviewingRequest(undefined)
      await refreshPlatform()
      window.dispatchEvent(new Event(INBOX_REFRESH_EVENT))
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save')
    } finally {
      setReviewingBusy(false)
    }
  }

  const openSeatDecision = useCallback(
    (mode: SeatRequestDecisionMode, row: NonNullable<UnifiedInboxItem['seatRequest']>) => {
      if (mode !== 'view' && !isOpenSeatRequest(row.status)) {
        setSeatDecision({ mode: 'view', row })
        return
      }
      setSeatDecision({ mode, row })
    },
    [],
  )

  const submitSeatDecision = async ({
    paymentReference,
    message,
  }: {
    paymentReference: string
    message: string
  }) => {
    if (!seatDecision) return
    const { mode: decisionMode, row } = seatDecision
    if (decisionMode === 'view') return
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
      {readNotice && isReleaseStyleNoticeKind(readNotice.kind) ? (
        <ReleaseNoticeModal
          open
          notice={readNotice}
          onClose={() => setReadNotice(null)}
        />
      ) : (
        <Modal
          open={readNotice != null}
          onClose={() => setReadNotice(null)}
          title={readNotice?.title ?? 'Message'}
          subtitle={
            readNotice?.created_by_name?.trim()
              ? `From ${readNotice.created_by_name.trim()}`
              : platformConsole
                ? undefined
                : 'From Tradeal'
          }
          size="md"
        >
          <p className="text-sm text-heading whitespace-pre-wrap leading-relaxed">
            {readNotice?.body}
          </p>
        </Modal>
      )}

      <FeatureLaunchInterestModal
        open={featureInterest != null}
        notice={featureInterest}
        loading={featureInterestBusy}
        onClose={() => !featureInterestBusy && setFeatureInterest(null)}
        onSubmitInterest={async (notificationId, featureKeys) => {
          setFeatureInterestBusy(true)
          try {
            const { organisationApi } = await import('../api/organisationApi')
            await organisationApi.expressFeatureInterest(notificationId, featureKeys)
            toast.success('Request sent — Tradeal will review and notify your organisation')
            setFeatureInterest(null)
            await refresh()
          } catch (err) {
            toast.error(err instanceof ApiError ? err.message : 'Could not send request')
          } finally {
            setFeatureInterestBusy(false)
          }
        }}
      />

      <FeatureEnhancementModal
        open={featureOffer != null}
        notice={featureOffer}
        appliedKeys={session?.appliedUpdates ?? []}
        loading={featureOfferBusy}
        onClose={() => !featureOfferBusy && setFeatureOffer(null)}
        onEnable={async (notificationId, featureKeys) => {
          setFeatureOfferBusy(true)
          try {
            await applyNotice(notificationId, featureKeys)
            toast.success(
              featureKeys.length === 1
                ? 'Enhancement enabled on your account'
                : `${featureKeys.length} enhancements enabled`,
            )
            setFeatureOffer(null)
          } catch (err) {
            toast.error(err instanceof ApiError ? err.message : 'Could not enable enhancements')
          } finally {
            setFeatureOfferBusy(false)
          }
        }}
      />

      <SystemUpdateModal
        open={!!updating}
        notification={updating}
        onClose={() => setUpdating(null)}
        onApply={id => applyNotice(id)}
      />

      <PlatformProductRequestModal
        open={reviewingRequest != null}
        request={reviewingRequest ?? null}
        loading={reviewingBusy}
        onClose={() => !reviewingBusy && setReviewingRequest(undefined)}
        onSave={body => void saveProductReview(body)}
      />

      <PlatformFeatureInterestModal
        open={reviewingInterest != null}
        interest={reviewingInterest}
        loading={interestReviewBusy}
        onClose={() => !interestReviewBusy && setReviewingInterest(null)}
        onApprove={async note => {
          if (!reviewingInterest) return
          const wasRejected = reviewingInterest.status === 'rejected'
          setInterestReviewBusy(true)
          try {
            await platformApi.approveFeatureInterest(reviewingInterest.id, note)
            toast.success(
              wasRejected ? 'Access restored for organisation' : 'Feature enabled for organisation',
            )
            setReviewingInterest(null)
            await refreshPlatform()
            window.dispatchEvent(new Event(INBOX_REFRESH_EVENT))
          } catch (err) {
            toast.error(err instanceof ApiError ? err.message : 'Could not approve')
          } finally {
            setInterestReviewBusy(false)
          }
        }}
        onReject={async note => {
          if (!reviewingInterest) return
          const wasApproved = reviewingInterest.status === 'approved'
          setInterestReviewBusy(true)
          try {
            await platformApi.rejectFeatureInterest(reviewingInterest.id, note)
            toast.success(
              wasApproved
                ? 'Access revoked — organisation notified'
                : 'Request declined',
            )
            setReviewingInterest(null)
            await refreshPlatform()
            window.dispatchEvent(new Event(INBOX_REFRESH_EVENT))
          } catch (err) {
            toast.error(err instanceof ApiError ? err.message : 'Could not decline')
          } finally {
            setInterestReviewBusy(false)
          }
        }}
      />

      <PlatformSeatRequestDecisionModal
        open={seatDecision != null}
        mode={seatDecision?.mode ?? 'approve'}
        request={seatDecision?.row ?? null}
        loading={seatDecisionBusy}
        viewAudience={platformConsole ? 'platform' : 'org'}
        onClose={() => !seatDecisionBusy && setSeatDecision(null)}
        onSubmit={payload => void submitSeatDecision(payload)}
      />
    </>
  )

  return { handleSelect, openSeatDecision, modals }
}
