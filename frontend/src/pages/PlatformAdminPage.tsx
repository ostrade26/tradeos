import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { Building2, CreditCard, RefreshCw, Wallet, Bell, Sparkles } from 'lucide-react'
import { PageHeader } from '../components/ui/CommandPalette'
import { Breadcrumb, EmptyState } from '../components/ui/Tabs'
import { Button } from '../components/ui/Button'
import { DataTable, TableSkeleton } from '../components/ui/DataTable'
import { useToast } from '../hooks/useToast'
import { useLargeScreen } from '../hooks/useMediaQuery'
import { loadOrderPanelDocked, saveOrderPanelDocked } from '../lib/orderPanelDock'
import { useDetailPanelSlot } from '../components/layout/DetailPanelSlot'
import { ApiError } from '../api/client'
import {
  platformApi,
  type OrganisationAmc,
  type OrganisationDetailResponse,
  type OrganisationLicence,
  type OrganisationPayment,
  type OrganisationSeat,
  type NotificationAudience,
  type PlatformDashboard,
  type PlatformOrganisation,
  type PlatformRelease,
  type PlatformUser,
  type SeatRequest,
  type SubscriptionPlan,
} from '../api/platformApi'
import { loadRegisterSort, saveRegisterSort, toggleSort } from '../lib/registerSort'
import { formatDateTime } from '../lib/utils'
import {
  amcColumns,
  auditLogColumns,
  licenceColumns,
  mapAuditLogs,
  organisationColumns,
  paymentColumns,
  platformSeatColumns,
  releaseColumns,
  seatRequestColumns,
  sortPlatformRows,
  subscriptionPlanColumns,
} from '../components/platform/platformAdminRegisterColumns'
import { PlatformOrganisationDetailDrawer } from '../components/platform/PlatformOrganisationDetailDrawer'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import {
  PlatformCreateOrganisationModal,
  type OrganisationFormState,
} from '../components/platform/PlatformCreateOrganisationModal'
import { PlatformEditOrganisationModal } from '../components/platform/PlatformEditOrganisationModal'
import { PlatformAddSeatModal } from '../components/platform/PlatformAddSeatModal'
import {
  PlatformSeatRequestDecisionModal,
  type SeatRequestDecisionMode,
} from '../components/platform/PlatformSeatRequestDecisionModal'
import {
  PlatformSignInCredentialsModal,
  type SignInCredentialsPayload,
} from '../components/platform/PlatformSignInCredentialsModal'
import type { OrgSeatType } from '../lib/platformLabels'
import { PlatformPlanModal, type PlanFormPayload } from '../components/platform/PlatformPlanModal'
import { PlatformRecordPaymentModal } from '../components/platform/PlatformRecordPaymentModal'
import { PlatformCommercialMetrics } from '../components/platform/PlatformCommercialMetrics'
import { PlatformNotifyModal } from '../components/platform/PlatformNotifyModal'
import { PlatformReleaseModal, type ReleaseFormPayload } from '../components/platform/PlatformReleaseModal'
import { PlatformPublishReleaseModal } from '../components/platform/PlatformPublishReleaseModal'
const PLATFORM_SECTIONS = [
  'organisations',
  'seats',
  'plans',
  'licenses',
  'amcs',
  'payments',
  'seat-requests',
  'audit',
  'releases',
] as const
type PlatformSection = (typeof PLATFORM_SECTIONS)[number]

function isPlatformSection(value: string | undefined): value is PlatformSection {
  return !!value && (PLATFORM_SECTIONS as readonly string[]).includes(value)
}

const SECTION_META: Record<
  PlatformSection,
  { title: string; subtitle: string; breadcrumb: string }
> = {
  organisations: {
    title: 'Organisations',
    subtitle: 'Profiles, licences, and seats',
    breadcrumb: 'Organisations',
  },
  seats: {
    title: 'Licensed seats',
    subtitle: 'Seats assigned to active organisation users',
    breadcrumb: 'Seats',
  },
  plans: {
    title: 'Plans & Pricing',
    subtitle: 'Current catalogue — existing licences keep their recorded prices',
    breadcrumb: 'Plans & Pricing',
  },
  licenses: {
    title: 'Licences',
    subtitle: 'Organisation perpetual licences and commercial snapshots',
    breadcrumb: 'Licences',
  },
  amcs: {
    title: 'AMC / Renewals',
    subtitle: 'Annual maintenance periods. Expiry does not lock trade data.',
    breadcrumb: 'AMC / Renewals',
  },
  payments: {
    title: 'Payments',
    subtitle: 'Manual licence, AMC, and seat payment records',
    breadcrumb: 'Payments',
  },
  'seat-requests': {
    title: 'Seat requests',
    subtitle: 'Approve after off-platform payment',
    breadcrumb: 'Seat requests',
  },
  audit: {
    title: 'Audit log',
    subtitle: 'Org, licence, AMC, and seat events',
    breadcrumb: 'Audit',
  },
  releases: {
    title: 'Releases',
    subtitle: 'Versioned what\'s new. Publish to the licences you choose.',
    breadcrumb: 'Releases',
  },
}

export function PlatformAdminPage() {
  const { section: sectionParam } = useParams<{ section: string }>()
  if (sectionParam === 'users') {
    return <Navigate to="/platform-admin/seats" replace />
  }
  if (!isPlatformSection(sectionParam)) {
    return <Navigate to="/platform-admin/organisations" replace />
  }
  return <PlatformAdminSectionView section={sectionParam} />
}

function PlatformAdminSectionView({ section }: { section: PlatformSection }) {
  const meta = SECTION_META[section]
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [organisations, setOrganisations] = useState<PlatformOrganisation[]>([])
  const [licensedSeats, setLicensedSeats] = useState<OrganisationSeat[]>([])
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [licenses, setLicenses] = useState<OrganisationLicence[]>([])
  const [amcs, setAmcs] = useState<OrganisationAmc[]>([])
  const [payments, setPayments] = useState<OrganisationPayment[]>([])
  const [dashboard, setDashboard] = useState<PlatformDashboard | null>(null)
  const [planModalOpen, setPlanModalOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null)
  const [savingPlan, setSavingPlan] = useState(false)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [savingPayment, setSavingPayment] = useState(false)
  const [notifyOpen, setNotifyOpen] = useState(false)
  const [notifyAudience, setNotifyAudience] = useState<NotificationAudience>('org')
  const [savingNotice, setSavingNotice] = useState(false)
  const [releases, setReleases] = useState<PlatformRelease[]>([])
  const [nextReleaseVersion, setNextReleaseVersion] = useState('1.0.0')
  const [releaseModalOpen, setReleaseModalOpen] = useState(false)
  const [editingRelease, setEditingRelease] = useState<PlatformRelease | null>(null)
  const [savingRelease, setSavingRelease] = useState(false)
  const [publishingReleaseRow, setPublishingReleaseRow] = useState<PlatformRelease | null>(null)
  const [publishingRelease, setPublishingRelease] = useState(false)
  const [orgUsers, setOrgUsers] = useState<PlatformUser[]>([])
  const [busyLicenceId, setBusyLicenceId] = useState<number | null>(null)
  const [busyAmcId, setBusyAmcId] = useState<number | null>(null)

  const [createOrgOpen, setCreateOrgOpen] = useState(false)
  const [creatingOrg, setCreatingOrg] = useState(false)
  const createOrgInFlight = useRef(false)
  const [addSeatModalOpen, setAddSeatModalOpen] = useState(false)
  const [editOrgOpen, setEditOrgOpen] = useState(false)
  const [savingOrg, setSavingOrg] = useState(false)
  const [searchParams] = useSearchParams()

  const [orgDetailOpen, setOrgDetailOpen] = useState(false)
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null)
  const [orgDetail, setOrgDetail] = useState<OrganisationDetailResponse | null>(null)
  const [signInCredentials, setSignInCredentials] = useState<SignInCredentialsPayload | null>(null)
  const [resettingPrimarySignIn, setResettingPrimarySignIn] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [addingSeat, setAddingSeat] = useState(false)
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [orgSort, setOrgSort] = useState(() => loadRegisterSort('platform-orgs', 'name'))
  const [seatSort, setSeatSort] = useState(() => loadRegisterSort('platform-seats', 'organisation_name'))
  const [planSort, setPlanSort] = useState(() => loadRegisterSort('platform-plans', 'name'))
  const [licenceSort, setLicenceSort] = useState(() => loadRegisterSort('platform-licenses', 'licence_number'))
  const [amcSort, setAmcSort] = useState(() => loadRegisterSort('platform-amcs', 'end_date'))
  const [paymentSort, setPaymentSort] = useState(() => loadRegisterSort('platform-payments', 'payment_date'))
  const [releaseSort, setReleaseSort] = useState(() => loadRegisterSort('platform-releases', 'version'))
  const [auditSort, setAuditSort] = useState(() => loadRegisterSort('platform-audit', 'created_at'))
  const [seatRequests, setSeatRequests] = useState<SeatRequest[]>([])
  const [seatRequestLoading, setSeatRequestLoading] = useState(false)
  const [seatRequestSort, setSeatRequestSort] = useState(() => loadRegisterSort('platform-seat-requests', 'created_at'))
  const [busySeatRequestId, setBusySeatRequestId] = useState<number | null>(null)
  const [seatDecision, setSeatDecision] = useState<{
    mode: SeatRequestDecisionMode
    row: SeatRequest
  } | null>(null)
  const [seatDecisionSubmitting, setSeatDecisionSubmitting] = useState(false)

  const [deleteOrgTarget, setDeleteOrgTarget] = useState<PlatformOrganisation | null>(null)
  const [deletingOrg, setDeletingOrg] = useState(false)
  const [panelDocked, setPanelDocked] = useState(() => loadOrderPanelDocked())
  const isLargeScreen = useLargeScreen()
  const effectiveDocked = panelDocked && isLargeScreen
  const { setOpen: setDetailPanelOpen } = useDetailPanelSlot()

  const closeOrgDetail = useCallback(() => {
    setDetailPanelOpen(false)
    setOrgDetailOpen(false)
    setOrgDetail(null)
    setSelectedOrgId(null)
  }, [setDetailPanelOpen])

  const handleDockChange = useCallback((docked: boolean) => {
    if (!docked) setDetailPanelOpen(false)
    setPanelDocked(docked)
    saveOrderPanelDocked(docked)
  }, [setDetailPanelOpen])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [orgRes, planRes] = await Promise.all([
        platformApi.listOrganisations(),
        platformApi.listPlans(),
      ])
      setOrganisations(orgRes.organisations)
      setPlans(planRes.plans)
      try {
        const [seatRes, dashRes, licRes, amcRes, payRes, relRes] = await Promise.all([
          platformApi.listSeats().catch(() => ({ seats: [] as OrganisationSeat[] })),
          platformApi.dashboard().catch(() => null),
          platformApi.listLicenses().catch(() => ({ licenses: [] as OrganisationLicence[] })),
          platformApi.listAmcs().catch(() => ({ amcs: [] as OrganisationAmc[] })),
          platformApi.listPayments().catch(() => ({ payments: [] as OrganisationPayment[] })),
          platformApi.listReleases().catch(() => ({
            releases: [] as PlatformRelease[],
            next_version: '1.0.0',
            latest_version: null,
          })),
        ])
        setLicensedSeats(seatRes.seats)
        setDashboard(dashRes)
        setLicenses(licRes.licenses)
        setAmcs(amcRes.amcs)
        setPayments(payRes.payments)
        setReleases(relRes.releases)
        setNextReleaseVersion(relRes.next_version || '1.0.0')
      } catch {
        setLicensedSeats([])
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not load platform data')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const loadSeatRequests = useCallback(async () => {
    setSeatRequestLoading(true)
    try {
      const res = await platformApi.listSeatRequests()
      setSeatRequests(res.requests)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not load seat requests')
    } finally {
      setSeatRequestLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (section === 'seat-requests') void loadSeatRequests()
  }, [section, loadSeatRequests])

  const orgColumns = useMemo(() => organisationColumns(), [])
  const seatColumns = useMemo(() => platformSeatColumns(), [])
  const planColumns = useMemo(() => subscriptionPlanColumns(), [])
  const payColumns = useMemo(() => paymentColumns(), [])
  const auditColumns = useMemo(() => auditLogColumns(), [])

  const sortedOrganisations = useMemo(
    () => sortPlatformRows(organisations, orgSort, orgColumns),
    [organisations, orgSort, orgColumns],
  )
  const sortedLicensedSeats = useMemo(
    () => sortPlatformRows(licensedSeats, seatSort, seatColumns),
    [licensedSeats, seatSort, seatColumns],
  )
  const sortedPlans = useMemo(
    () => sortPlatformRows(plans, planSort, planColumns),
    [plans, planSort, planColumns],
  )

  const openSeatDecision = useCallback((mode: SeatRequestDecisionMode, row: SeatRequest) => {
    setSeatDecision({ mode, row })
  }, [])

  const closeSeatDecision = useCallback(() => {
    if (seatDecisionSubmitting) return
    setSeatDecision(null)
  }, [seatDecisionSubmitting])

  const submitSeatDecision = useCallback(
    async ({ paymentReference, message }: { paymentReference: string; message: string }) => {
      if (!seatDecision) return
      const { mode, row } = seatDecision
      setSeatDecisionSubmitting(true)
      setBusySeatRequestId(row.id)
      try {
        if (mode === 'approve') {
          const res = await platformApi.approveSeatRequest(row.id, {
            payment_reference: paymentReference,
            admin_note: message,
          })
          toast.success(
            `Approved · ${res.seats.available_seats} seat${res.seats.available_seats === 1 ? '' : 's'} available for assignment`,
          )
          await Promise.all([loadSeatRequests(), load()])
        } else {
          await platformApi.rejectSeatRequest(row.id, message)
          toast.success('Request rejected')
          await loadSeatRequests()
        }
        setSeatDecision(null)
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : mode === 'approve' ? 'Could not approve' : 'Could not reject')
      } finally {
        setSeatDecisionSubmitting(false)
        setBusySeatRequestId(null)
      }
    },
    [load, loadSeatRequests, seatDecision, toast],
  )

  const handleApproveSeat = useCallback(
    (row: SeatRequest) => openSeatDecision('approve', row),
    [openSeatDecision],
  )

  const handleRejectSeat = useCallback(
    (row: SeatRequest) => openSeatDecision('reject', row),
    [openSeatDecision],
  )

  const seatRequestColumnDefs = useMemo(
    () =>
      seatRequestColumns({
        busyId: busySeatRequestId,
        onApprove: row => void handleApproveSeat(row),
        onReject: row => void handleRejectSeat(row),
      }),
    [busySeatRequestId, handleApproveSeat, handleRejectSeat],
  )

  const sortedSeatRequests = useMemo(
    () => sortPlatformRows(seatRequests, seatRequestSort, seatRequestColumnDefs),
    [seatRequests, seatRequestSort, seatRequestColumnDefs],
  )

  const handleSeatRequestSortChange = useCallback((key: string) => {
    setSeatRequestSort(prev => {
      const next = toggleSort(prev, key)
      saveRegisterSort('platform-seat-requests', next)
      return next
    })
  }, [])
  const auditRows = useMemo(() => mapAuditLogs(auditLogs), [auditLogs])
  const sortedAuditRows = useMemo(
    () => sortPlatformRows(auditRows, auditSort, auditColumns),
    [auditRows, auditSort, auditColumns],
  )

  const auditOrgFilter = searchParams.get('organisation_id')
  const auditUserFilter = searchParams.get('user_id')

  const filteredAuditRows = useMemo(() => {
    let rows = sortedAuditRows
    if (auditOrgFilter) {
      rows = rows.filter(r => r.organisation_id === auditOrgFilter)
    }
    if (auditUserFilter) {
      rows = rows.filter(
        r =>
          (r.entity_type === 'user' && r.entity_id === auditUserFilter) ||
          r.actor_user_id === auditUserFilter,
      )
    }
    return rows
  }, [sortedAuditRows, auditOrgFilter, auditUserFilter])

  const handleOrgSortChange = useCallback((key: string) => {
    setOrgSort(prev => {
      const next = toggleSort(prev, key)
      saveRegisterSort('platform-orgs', next)
      return next
    })
  }, [])

  const handleSeatSortChange = useCallback((key: string) => {
    setSeatSort(prev => {
      const next = toggleSort(prev, key)
      saveRegisterSort('platform-seats', next)
      return next
    })
  }, [])

  const handlePlanSortChange = useCallback((key: string) => {
    setPlanSort(prev => {
      const next = toggleSort(prev, key)
      saveRegisterSort('platform-plans', next)
      return next
    })
  }, [])

  const handleLicenceSortChange = useCallback((key: string) => {
    setLicenceSort(prev => {
      const next = toggleSort(prev, key)
      saveRegisterSort('platform-licenses', next)
      return next
    })
  }, [])

  const handleAmcSortChange = useCallback((key: string) => {
    setAmcSort(prev => {
      const next = toggleSort(prev, key)
      saveRegisterSort('platform-amcs', next)
      return next
    })
  }, [])

  const handlePaymentSortChange = useCallback((key: string) => {
    setPaymentSort(prev => {
      const next = toggleSort(prev, key)
      saveRegisterSort('platform-payments', next)
      return next
    })
  }, [])

  const handleReleaseSortChange = useCallback((key: string) => {
    setReleaseSort(prev => {
      const next = toggleSort(prev, key)
      saveRegisterSort('platform-releases', next)
      return next
    })
  }, [])

  const updateLicenceStatus = useCallback(
    async (row: OrganisationLicence, status: string) => {
      setBusyLicenceId(row.id)
      try {
        await platformApi.updateLicenceStatus(row.id, status)
        toast.success(`Licence ${status}`)
        await load()
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Could not update licence')
      } finally {
        setBusyLicenceId(null)
      }
    },
    [load, toast],
  )

  const renewAmcRow = useCallback(
    async (row: OrganisationAmc) => {
      setBusyAmcId(row.id)
      try {
        await platformApi.renewAmc(row.licence_id, 'pending')
        toast.success('AMC renewed at the licence’s recorded price')
        await load()
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Could not renew AMC')
      } finally {
        setBusyAmcId(null)
      }
    },
    [load, toast],
  )

  const licenceColumnDefs = useMemo(
    () =>
      licenceColumns({
        busyId: busyLicenceId,
        onActivate: row => void updateLicenceStatus(row, 'active'),
        onSuspend: row => void updateLicenceStatus(row, 'suspended'),
      }),
    [busyLicenceId, updateLicenceStatus],
  )

  const amcColumnDefs = useMemo(
    () =>
      amcColumns({
        busyId: busyAmcId,
        onRenew: row => void renewAmcRow(row),
      }),
    [busyAmcId, renewAmcRow],
  )

  const sortedLicenses = useMemo(
    () => sortPlatformRows(licenses, licenceSort, licenceColumnDefs),
    [licenses, licenceSort, licenceColumnDefs],
  )
  const sortedAmcs = useMemo(() => sortPlatformRows(amcs, amcSort, amcColumnDefs), [amcs, amcSort, amcColumnDefs])
  const sortedPayments = useMemo(
    () => sortPlatformRows(payments, paymentSort, payColumns),
    [payments, paymentSort, payColumns],
  )

  const submitPlan = async (form: PlanFormPayload) => {
    setSavingPlan(true)
    try {
      await platformApi.upsertPlan(form)
      toast.success(editingPlan ? 'Plan updated' : 'Plan saved')
      setPlanModalOpen(false)
      setEditingPlan(null)
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save plan')
    } finally {
      setSavingPlan(false)
    }
  }

  const submitPayment = async (payload: {
    organisation_id: number
    payment_type: 'licence' | 'amc' | 'additional_seat' | 'other'
    amount_cents: number
    payment_date: string
    payment_reference: string
    status: 'pending' | 'paid' | 'failed' | 'refunded'
    notes: string
  }) => {
    setSavingPayment(true)
    try {
      await platformApi.recordPayment(payload)
      toast.success('Payment recorded')
      setPaymentModalOpen(false)
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not record payment')
    } finally {
      setSavingPayment(false)
    }
  }

  const openNotify = async (audience: NotificationAudience = 'org') => {
    setNotifyAudience(audience)
    setNotifyOpen(true)
    try {
      const res = await platformApi.listUsers()
      setOrgUsers(res.users)
    } catch {
      setOrgUsers([])
    }
  }

  const submitNotice = async (payload: {
    audience: NotificationAudience
    organisation_id: number | null
    recipient_user_id: number | null
    recipient_scope: 'org_admin' | 'all_users'
    exclude_expired_amc: boolean
    kind: 'payment_reminder' | 'product_update' | 'feature_launch' | 'credentials' | 'release_notes'
    title: string
    body: string
    feature_key?: string
    items?: string
  }) => {
    setSavingNotice(true)
    try {
      const res = await platformApi.sendNotification({
        ...payload,
        payload: payload.items ? { items: payload.items } : undefined,
      })
      const skipped = res.skipped_expired_amc
        ? ` · ${res.skipped_expired_amc} skipped (expired AMC)`
        : ''
      toast.success(`Sent to ${res.sent} ${res.sent === 1 ? 'person' : 'people'}${skipped}`)
      setNotifyOpen(false)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not send notice')
    } finally {
      setSavingNotice(false)
    }
  }

  const openReleaseEditor = (row: PlatformRelease | null) => {
    setEditingRelease(row)
    setReleaseModalOpen(true)
  }

  const openReleasePublish = async (row: PlatformRelease) => {
    setPublishingReleaseRow(row)
    try {
      const res = await platformApi.listUsers()
      setOrgUsers(res.users)
    } catch {
      setOrgUsers([])
    }
  }

  const submitRelease = async (payload: ReleaseFormPayload) => {
    setSavingRelease(true)
    try {
      if (editingRelease) {
        await platformApi.updateRelease(editingRelease.id, payload)
        toast.success(`Saved ${payload.version}`)
      } else {
        await platformApi.createRelease(payload)
        toast.success(`Draft ${payload.version} created`)
      }
      setReleaseModalOpen(false)
      setEditingRelease(null)
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save release')
    } finally {
      setSavingRelease(false)
    }
  }

  const submitPublishRelease = async (payload: {
    audience: NotificationAudience
    organisation_id: number | null
    recipient_user_id: number | null
    recipient_scope: 'org_admin' | 'all_users'
    exclude_expired_amc: boolean
  }) => {
    if (!publishingReleaseRow) return
    setPublishingRelease(true)
    try {
      const res = await platformApi.publishRelease(publishingReleaseRow.id, payload)
      const skipped = res.release.skipped_expired_amc
        ? ` · ${res.release.skipped_expired_amc} skipped (expired AMC)`
        : ''
      toast.success(`Published ${res.release.version} to ${res.release.sent ?? 0} ${res.release.sent === 1 ? 'person' : 'people'}${skipped}`)
      setPublishingReleaseRow(null)
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not publish release')
    } finally {
      setPublishingRelease(false)
    }
  }

  const relColumns = useMemo(
    () => releaseColumns({ onEdit: openReleaseEditor, onPublish: row => void openReleasePublish(row) }),
    [],
  )
  const sortedReleases = useMemo(
    () => sortPlatformRows(releases, releaseSort, relColumns),
    [releases, releaseSort, relColumns],
  )

  const handleAuditSortChange = useCallback((key: string) => {
    setAuditSort(prev => {
      const next = toggleSort(prev, key)
      saveRegisterSort('platform-audit', next)
      return next
    })
  }, [])

  const loadOrgDetail = useCallback(async (orgId: number) => {
    setSelectedOrgId(orgId)
    setOrgDetailOpen(true)
    setLoadingDetail(true)
    try {
      const detail = await platformApi.getOrganisation(orgId)
      setOrgDetail(detail)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not load organisation')
      setOrgDetail(null)
    } finally {
      setLoadingDetail(false)
    }
  }, [toast])

  const resetPrimaryAdminSignIn = useCallback(async () => {
    const userId = orgDetail?.primary_admin_user?.user_id
    if (!userId || resettingPrimarySignIn) return
    setResettingPrimarySignIn(true)
    try {
      const result = await platformApi.resetUserSignIn(userId)
      setSignInCredentials({
        name: result.name,
        login_id: result.login_id,
        username: result.username,
        email: result.email,
        temporary_password: result.temporary_password,
        organisation_id: orgDetail.organisation.id,
        recipient_user_id: userId,
      })
      toast.success('New temporary password issued')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not reset sign-in')
    } finally {
      setResettingPrimarySignIn(false)
    }
  }, [orgDetail?.organisation.id, orgDetail?.primary_admin_user?.user_id, resettingPrimarySignIn, toast])

  const submitCreateOrg = async (form: OrganisationFormState) => {
    if (createOrgInFlight.current) return
    createOrgInFlight.current = true
    setCreatingOrg(true)
    try {
      const detail = await platformApi.createOrganisation({
        name: form.name.trim(),
        legal_name: form.legal_name.trim(),
        gstin: form.gstin.trim(),
        pan: form.pan.trim(),
        business_address: form.business_address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        country: form.country.trim(),
        pincode: form.pincode.trim(),
        plan_id: form.plan_id ? Number(form.plan_id) : undefined,
        billing_cycle: form.billing_cycle,
        primary_admin: {
          name: form.admin_name.trim(),
          email: form.admin_email.trim(),
          mobile: form.admin_mobile.trim(),
        },
      })
      setCreateOrgOpen(false)
      await load()
      toast.success(`Organisation “${detail.organisation.name}” created`)
      if (detail.primary_admin?.temporary_password) {
        setSignInCredentials({
          name: detail.organisation.primary_contact_name ?? undefined,
          login_id: detail.primary_admin.username,
          temporary_password: detail.primary_admin.temporary_password,
          organisation_id: detail.organisation.id,
          recipient_user_id: detail.primary_admin.user_id,
        })
      }
      void loadOrgDetail(detail.organisation.id)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not create organisation')
    } finally {
      createOrgInFlight.current = false
      setCreatingOrg(false)
    }
  }

  const openAddSeatModal = () => {
    if (!selectedOrgId) return
    setAddSeatModalOpen(true)
  }

  const submitAddSeat = async (payload: { count: number; seat_type: OrgSeatType }) => {
    if (!selectedOrgId) return
    setAddingSeat(true)
    try {
      await platformApi.addSeats(selectedOrgId, payload.count, payload.seat_type)
      toast.success('Seat(s) added')
      const detail = await platformApi.getOrganisation(selectedOrgId)
      setOrgDetail(detail)
      setAddSeatModalOpen(false)
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not add seat')
    } finally {
      setAddingSeat(false)
    }
  }

  const loadAudit = useCallback(async () => {
    setAuditLoading(true)
    try {
      const orgFilter = auditOrgFilter ? Number(auditOrgFilter) : undefined
      const res = await platformApi.listAuditLogs(orgFilter ?? selectedOrgId ?? undefined)
      setAuditLogs(res.logs)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not load audit log')
    } finally {
      setAuditLoading(false)
    }
  }, [auditOrgFilter, selectedOrgId, toast])

  useEffect(() => {
    if (section === 'audit') void loadAudit()
  }, [section, loadAudit])

  const confirmDeleteOrg = async () => {
    if (!deleteOrgTarget) return
    setDeletingOrg(true)
    try {
      await platformApi.deleteOrganisation(deleteOrgTarget.id)
      toast.success(`Organisation “${deleteOrgTarget.name}” deleted`)
      if (selectedOrgId === deleteOrgTarget.id) {
        closeOrgDetail()
      }
      setDeleteOrgTarget(null)
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not delete organisation')
      throw err
    } finally {
      setDeletingOrg(false)
    }
  }

  const submitEditOrg = async (patch: {
    name: string
    legal_name: string
    gstin: string
    pan: string
    business_address: string
    city: string
    state: string
    country: string
    pincode: string
    status: string
  }) => {
    if (!orgDetail) return
    setSavingOrg(true)
    try {
      const updated = await platformApi.updateOrganisation(orgDetail.organisation.id, patch)
      setOrgDetail(updated)
      setEditOrgOpen(false)
      toast.success('Organisation updated')
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update organisation')
    } finally {
      setSavingOrg(false)
    }
  }

  const pageActions =
    section === 'organisations' ? (
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => void openNotify('active_licences')}>
          <Bell className="h-4 w-4" aria-hidden />
          Send notice
        </Button>
        <Button size="sm" onClick={() => setCreateOrgOpen(true)}>
          <Building2 className="h-4 w-4" aria-hidden />
          Add organisation
        </Button>
      </div>
    ) : section === 'plans' ? (
      <Button
        size="sm"
        onClick={() => {
          setEditingPlan(null)
          setPlanModalOpen(true)
        }}
      >
        <CreditCard className="h-4 w-4" aria-hidden />
        New plan
      </Button>
    ) : section === 'payments' ? (
      <Button size="sm" onClick={() => setPaymentModalOpen(true)}>
        <Wallet className="h-4 w-4" aria-hidden />
        Record payment
      </Button>
    ) : section === 'seat-requests' ? (
      <Button variant="outline" size="sm" loading={seatRequestLoading} onClick={() => void loadSeatRequests()}>
        <RefreshCw className="h-4 w-4" aria-hidden />
        Refresh
      </Button>
    ) : section === 'releases' ? (
      <Button
        size="sm"
        onClick={() => {
          setEditingRelease(null)
          setReleaseModalOpen(true)
        }}
      >
        <Sparkles className="h-4 w-4" aria-hidden />
        New release
      </Button>
    ) : section === 'audit' ? (
      <Button variant="outline" size="sm" loading={auditLoading} onClick={() => void loadAudit()}>
        <RefreshCw className="h-4 w-4" aria-hidden />
        Refresh
      </Button>
    ) : undefined

  return (
    <div className="animate-fade-in space-y-4 min-w-0">
      <PageHeader
        title={meta.title}
        subtitle={
          section === 'organisations'
            ? `${organisations.length} organisations`
            : section === 'seats'
              ? `${licensedSeats.length} seat${licensedSeats.length === 1 ? '' : 's'} in use`
            : section === 'releases'
              ? `${releases.length} version${releases.length === 1 ? '' : 's'}`
              : meta.subtitle
        }
        breadcrumb={
          <Breadcrumb
            items={[
              { label: 'Platform Admin', href: '/platform-admin/organisations' },
              { label: meta.breadcrumb },
            ]}
          />
        }
        actions={pageActions}
        hideActionsOnMobile
      />

      {section === 'organisations' && dashboard && !loading ? (
        <PlatformCommercialMetrics metrics={dashboard} />
      ) : null}

      {section === 'organisations' &&
        (loading ? (
          <TableSkeleton rows={10} cols={8} />
        ) : (
          <DataTable
            data={sortedOrganisations}
            columns={orgColumns}
            getRowId={r => String(r.id)}
            stickyFirstColumn
            sortKey={orgSort.key}
            sortDirection={orgSort.direction}
            onSortChange={handleOrgSortChange}
            onRowClick={org => void loadOrgDetail(org.id)}
            activeRowId={orgDetailOpen && selectedOrgId != null ? String(selectedOrgId) : undefined}
            defaultPageSize={25}
            emptyState={
              <EmptyState
                title="No organisations yet"
                description="Add an org with a plan and primary admin."
                action={
                  <Button size="sm" onClick={() => setCreateOrgOpen(true)}>
                    <Building2 className="h-4 w-4" aria-hidden />
                    Add organisation
                  </Button>
                }
              />
            }
            mobileRender={org => (
              <div className="px-4 py-3 space-y-1">
                <p className="font-medium text-heading">{org.name}</p>
                <p className="text-xs text-muted">
                  {org.org_code ?? 'No code'} · {org.seats ? `${org.seats.active_assigned_seats}/${org.seats.total_entitled_seats} seats` : 'No seats'}
                </p>
              </div>
            )}
          />
        ))}

      {section === 'seats' &&
        (loading ? (
          <TableSkeleton rows={10} cols={5} />
        ) : (
          <DataTable
            data={sortedLicensedSeats}
            columns={seatColumns}
            getRowId={r => String(r.id)}
            stickyFirstColumn
            sortKey={seatSort.key}
            sortDirection={seatSort.direction}
            onSortChange={handleSeatSortChange}
            onRowClick={seat => void loadOrgDetail(seat.organisation_id)}
            defaultPageSize={25}
            emptyState={
              <EmptyState
                title="No seats in use"
                description="Assigned seats appear here when organisation users hold an active license."
              />
            }
            mobileRender={seat => (
              <div className="px-4 py-3 space-y-1">
                <p className="font-medium text-heading">{seat.organisation_name ?? `Org #${seat.organisation_id}`}</p>
                <p className="text-xs text-muted">
                  {seat.seat_label} · {seat.seat_type.replace(/_/g, ' ')}
                </p>
              </div>
            )}
          />
        ))}

      {section === 'plans' &&
        (loading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : (
          <DataTable
            data={sortedPlans}
            columns={planColumns}
            getRowId={r => String(r.id)}
            stickyFirstColumn
            sortKey={planSort.key}
            sortDirection={planSort.direction}
            onSortChange={handlePlanSortChange}
            onRowClick={plan => {
              setEditingPlan(plan)
              setPlanModalOpen(true)
            }}
            defaultPageSize={25}
            emptyState={
              <EmptyState
                title="No plans"
                description="No subscription plans are configured yet."
              />
            }
          />
        ))}

      {section === 'licenses' &&
        (loading ? (
          <TableSkeleton rows={8} cols={7} />
        ) : (
          <DataTable
            data={sortedLicenses}
            columns={licenceColumnDefs}
            getRowId={r => String(r.id)}
            stickyFirstColumn
            sortKey={licenceSort.key}
            sortDirection={licenceSort.direction}
            onSortChange={handleLicenceSortChange}
            onRowClick={row => void loadOrgDetail(row.organisation_id)}
            defaultPageSize={25}
            emptyState={
              <EmptyState title="No licences" description="Licences are issued when an organisation is created." />
            }
          />
        ))}

      {section === 'amcs' &&
        (loading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : (
          <DataTable
            data={sortedAmcs}
            columns={amcColumnDefs}
            getRowId={r => String(r.id)}
            stickyFirstColumn
            sortKey={amcSort.key}
            sortDirection={amcSort.direction}
            onSortChange={handleAmcSortChange}
            onRowClick={row => void loadOrgDetail(row.organisation_id)}
            defaultPageSize={25}
            emptyState={<EmptyState title="No AMC records" description="AMC periods are created with each licence." />}
          />
        ))}

      {section === 'payments' &&
        (loading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : (
          <DataTable
            data={sortedPayments}
            columns={payColumns}
            getRowId={r => String(r.id)}
            stickyFirstColumn
            sortKey={paymentSort.key}
            sortDirection={paymentSort.direction}
            onSortChange={handlePaymentSortChange}
            onRowClick={row => void loadOrgDetail(row.organisation_id)}
            defaultPageSize={25}
            emptyState={
              <EmptyState
                title="No payments"
                description="Record licence, AMC, or seat payments received off-platform."
                action={
                  <Button size="sm" onClick={() => setPaymentModalOpen(true)}>
                    Record payment
                  </Button>
                }
              />
            }
          />
        ))}

      {section === 'seat-requests' &&
        (seatRequestLoading && seatRequests.length === 0 ? (
          <TableSkeleton rows={8} cols={6} />
        ) : (
          <DataTable
            data={sortedSeatRequests}
            columns={seatRequestColumnDefs}
            getRowId={r => String(r.id)}
            stickyFirstColumn
            sortKey={seatRequestSort.key}
            sortDirection={seatRequestSort.direction}
            onSortChange={handleSeatRequestSortChange}
            defaultPageSize={25}
            emptyState={
              <EmptyState
                title="No seat requests"
                description="Submitted from org Settings after off-platform payment."
                action={
                  <Button variant="outline" size="sm" onClick={() => void loadSeatRequests()}>
                    Refresh
                  </Button>
                }
              />
            }
            mobileRender={row => (
              <div className="px-4 py-3 space-y-1">
                <p className="font-medium text-heading">{row.organisation_name ?? `Org #${row.organisation_id}`}</p>
                <p className="text-xs text-muted capitalize">{row.status.replace(/_/g, ' ')}</p>
              </div>
            )}
          />
        ))}

      {section === 'audit' && (auditOrgFilter || auditUserFilter) && (
        <p className="text-sm text-muted flex flex-wrap items-center gap-2">
          <span>
            Timeline filter
            {auditOrgFilter ? ` · organisation #${auditOrgFilter}` : ''}
            {auditUserFilter ? ` · user #${auditUserFilter}` : ''}
          </span>
          <Link to="/platform-admin/audit" className="text-accent font-medium hover:underline">
            Clear filter
          </Link>
        </p>
      )}

      {section === 'audit' &&
        (auditLoading && auditRows.length === 0 ? (
          <TableSkeleton rows={12} cols={5} />
        ) : (
          <DataTable
            data={filteredAuditRows}
            columns={auditColumns}
            getRowId={r => r.id}
            stickyFirstColumn
            sortKey={auditSort.key}
            sortDirection={auditSort.direction}
            onSortChange={handleAuditSortChange}
            defaultPageSize={50}
            emptyState={
              <EmptyState
                title="No audit entries"
                description="Events appear as orgs and subscriptions change."
                action={
                  <Button variant="outline" size="sm" onClick={() => void loadAudit()}>
                    Refresh
                  </Button>
                }
              />
            }
            mobileRender={row => (
              <div className="px-4 py-3 space-y-1">
                <p className="font-medium text-heading">{row.action}</p>
                <p className="text-xs text-muted tabular-nums">{formatDateTime(row.created_at)}</p>
              </div>
            )}
          />
        ))}

      {section === 'releases' &&
        (loading ? (
          <TableSkeleton rows={8} cols={5} />
        ) : (
          <DataTable
            data={sortedReleases}
            columns={relColumns}
            getRowId={r => String(r.id)}
            stickyFirstColumn
            sortKey={releaseSort.key}
            sortDirection={releaseSort.direction}
            onSortChange={handleReleaseSortChange}
            onRowClick={row => {
              if (row.status === 'draft') openReleaseEditor(row)
              else void openReleasePublish(row)
            }}
            defaultPageSize={25}
            emptyState={
              <EmptyState
                title="No releases"
                description="Create a versioned what’s new pack, then publish it to the licences you choose."
                action={
                  <Button size="sm" onClick={() => openReleaseEditor(null)}>
                    New release
                  </Button>
                }
              />
            }
            mobileRender={row => (
              <div className="px-4 py-3 space-y-1">
                <p className="font-medium text-heading font-mono tabular-nums">{row.version}</p>
                <p className="text-xs text-muted">{row.title}</p>
              </div>
            )}
          />
        ))}

      <PlatformCreateOrganisationModal
        open={createOrgOpen}
        onClose={() => setCreateOrgOpen(false)}
        plans={plans}
        loading={creatingOrg}
        onSubmit={form => void submitCreateOrg(form)}
      />

      <PlatformPlanModal
        open={planModalOpen}
        onClose={() => !savingPlan && setPlanModalOpen(false)}
        plan={editingPlan}
        loading={savingPlan}
        onSubmit={form => void submitPlan(form)}
      />

      <PlatformRecordPaymentModal
        open={paymentModalOpen}
        onClose={() => !savingPayment && setPaymentModalOpen(false)}
        organisations={organisations}
        defaultOrganisationId={selectedOrgId}
        loading={savingPayment}
        onSubmit={payload => void submitPayment(payload)}
      />

      <PlatformAddSeatModal
        open={addSeatModalOpen}
        onClose={() => !addingSeat && setAddSeatModalOpen(false)}
        organisationName={orgDetail?.organisation.name ?? 'Organisation'}
        loading={addingSeat}
        onSubmit={payload => void submitAddSeat(payload)}
      />

      <PlatformEditOrganisationModal
        open={editOrgOpen}
        onClose={() => setEditOrgOpen(false)}
        organisation={orgDetail?.organisation ?? null}
        loading={savingOrg}
        onSubmit={patch => void submitEditOrg(patch)}
      />

      <PlatformOrganisationDetailDrawer
        open={orgDetailOpen}
        detail={orgDetail}
        loading={loadingDetail}
        docked={effectiveDocked}
        onClose={closeOrgDetail}
        onDockChange={handleDockChange}
        onAddSeat={openAddSeatModal}
        addingSeat={addingSeat}
        onEdit={() => setEditOrgOpen(true)}
        onDelete={() => orgDetail && setDeleteOrgTarget(orgDetail.organisation)}
        onResetPrimaryAdminSignIn={() => void resetPrimaryAdminSignIn()}
        resettingPrimaryAdminSignIn={resettingPrimarySignIn}
        onNotify={() => void openNotify('org')}
      />

      <PlatformSignInCredentialsModal
        open={signInCredentials != null}
        onClose={() => setSignInCredentials(null)}
        payload={signInCredentials}
      />

      <PlatformNotifyModal
        open={notifyOpen}
        onClose={() => !savingNotice && setNotifyOpen(false)}
        organisations={organisations}
        organisationId={selectedOrgId}
        users={orgUsers}
        defaultRecipientUserId={orgDetail?.primary_admin_user?.user_id}
        defaultAudience={notifyAudience}
        loading={savingNotice}
        onSubmit={payload => void submitNotice(payload)}
      />

      <PlatformReleaseModal
        open={releaseModalOpen}
        onClose={() => !savingRelease && setReleaseModalOpen(false)}
        release={editingRelease}
        nextVersion={nextReleaseVersion}
        loading={savingRelease}
        onSubmit={payload => void submitRelease(payload)}
      />

      <PlatformPublishReleaseModal
        open={publishingReleaseRow != null}
        onClose={() => !publishingRelease && setPublishingReleaseRow(null)}
        release={publishingReleaseRow}
        organisations={organisations}
        users={orgUsers}
        loading={publishingRelease}
        onSubmit={payload => void submitPublishRelease(payload)}
      />

      <PlatformSeatRequestDecisionModal
        open={seatDecision != null}
        mode={seatDecision?.mode ?? 'approve'}
        request={seatDecision?.row ?? null}
        loading={seatDecisionSubmitting}
        onClose={closeSeatDecision}
        onSubmit={payload => void submitSeatDecision(payload)}
      />

      <ConfirmDialog
        open={deleteOrgTarget != null}
        onClose={() => !deletingOrg && setDeleteOrgTarget(null)}
        onConfirm={confirmDeleteOrg}
        title="Delete organisation?"
        confirmLabel="Delete organisation"
        variant="danger"
        confirmLoading={deletingOrg}
      >
        <p className="text-sm text-muted leading-relaxed">
          This permanently removes{' '}
          <span className="font-medium text-heading">{deleteOrgTarget?.name}</span>, its subscription, seats, trade
          data, and licensed seats. This cannot be undone.
        </p>
      </ConfirmDialog>
    </div>
  )
}
