import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useLocation } from 'react-router-dom'
import {
  type TradeOrder,
  type Lift,
  type LiftTanker,
  type Broker,
  type BrokerageTerms,
  type BrokerItemBrokerage,
  type Producer,
  type Retailer,
  type Company,
  type CompanyType,
  type Contract,
  type OrderSide,
  type DeliveryType,
  toBeLifted,
  getRemainingSellQty,
  getSOsForPO,
} from '../data/mockData'
import { getOutstandingBalance as calcOutstandingBalance, getSellerOutstandingBalance } from '../lib/liftBalance'
import { dedupeDirectory, refreshPartyLocationsFromOrders } from '../lib/ensureDirectoryFromOrders'
import { liftTouchesRef } from '../lib/liftAllocations'
import type { BuyBackInput } from '../lib/buyBack'
import type { CloseOrderMethod } from '../lib/orderClosure'
import { formatDeletionDate } from '../lib/orderDeletion'
import { formatQty, normalizeDateToIso, repairAmbiguousTradeDates } from '../lib/utils'
import { formatPoRef, formatSoRef, refCore } from '../lib/tradeRefs'
import type { CompanyResolutionResult } from '../lib/companyResolution'
import { tradeApi, type TradeData } from '../api/tradeApi'
import { useAuth } from '../hooks/useAuth'
import { useServiceIssue } from '../hooks/ServiceIssueProvider'
import { classifyUnknownError } from '../lib/serviceIssue'
import { SERVICE_ISSUE_UI_ENABLED } from '../lib/serviceIssueConfig'

export interface CreateOrderInput {
  ref?: string
  side: OrderSide
  poRef?: string
  brokerContractRef?: string
  date: string
  partyName: string
  partyCompanyId?: string
  sellerCompanyId?: string
  buyerCompanyId?: string
  extractedPartyName?: string
  extractedSellerName?: string
  extractedBuyerName?: string
  itemName: string
  spot: string
  deliveryType: DeliveryType
  deliveryPeriodStart: string
  deliveryPeriodEnd: string
  deliveryPeriodVerified?: boolean
  rate: number
  taxRate: number
  orderQty: number
  brokerName: string
  brokeragePct: number
  brokeragePerTon?: number
  sellerName?: string
  buyerName?: string
  partyConfirmedBy?: string
  sellerConfirmedBy?: string
  buyerConfirmedBy?: string
  contractRateDisplay?: string
  sellerGst?: string
  buyerGst?: string
  brand?: string
  rateBasis?: string
  ratePerBasis?: number
  paymentTerms?: string
  remarks?: string
}

export interface CreateLiftInput {
  allocations: { poRef: string; soRef?: string; qtyMt: number }[]
  date: string
  tankers: LiftTanker[]
  isSelfLift: boolean
  stockLift?: boolean
  balanceAppliedQtyMt?: number
  loadOnRisk?: boolean
  remarks?: string
}

export type UpdateLiftInput = CreateLiftInput & {
  salesInvoiceNo?: string
  poInvoiceNo?: string
}

export interface MarkLiftDeliveredInput {
  tankers: LiftTanker[]
  deliveredAt?: string
  salesInvoiceNo?: string
  poInvoiceNo?: string
  allocations?: { poRef: string; soRef?: string; qtyMt: number }[]
}

export interface AddBrokerInput {
  name: string
  email?: string
  phone?: string
  purchaseBrokerage?: BrokerageTerms
  saleBrokerage?: BrokerageTerms
  itemBrokerages?: BrokerItemBrokerage[]
}

export interface AddProducerInput {
  name: string
  location?: string
  products?: string
  code?: string
  address?: string
  city?: string
  contactPerson?: string
  phone?: string
  whatsapp?: string
  email?: string
  tan?: string
  fssai?: string
  bankName?: string
  bankAccount?: string
  ifsc?: string
  pan?: string
  aadhar?: string
  gst?: string
}

export interface AddRetailerInput {
  name: string
  location?: string
  products?: string
  code?: string
  address?: string
  city?: string
  contactPerson?: string
  phone?: string
  whatsapp?: string
  email?: string
  tan?: string
  fssai?: string
  bankName?: string
  bankAccount?: string
  ifsc?: string
  pan?: string
  aadhar?: string
  gst?: string
}

export interface ConfirmCompanyLinkInput {
  extractedName: string
  companyId?: string
  officialName?: string
  type: CompanyType
  gst?: string
  location?: string
}

export interface TradeStoreValue extends TradeData {
  ready: boolean
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  resetAll: () => Promise<void>
  loadDemo: () => Promise<void>
  importAll: (payload: { version?: number; data: TradeData }) => Promise<TradeData>
  createContract: (input: Record<string, unknown>) => Promise<Contract>
  addOrder: (input: CreateOrderInput) => Promise<TradeOrder>
  updateOrder: (id: string, input: CreateOrderInput) => Promise<TradeOrder>
  buyBackPo: (id: string, input: BuyBackInput) => Promise<TradeOrder>
  closeOrder: (id: string, input: { method: CloseOrderMethod; notes?: string; settledAt?: string }) => Promise<TradeOrder>
  addLift: (input: CreateLiftInput) => Promise<Lift>
  updateLift: (id: string, input: UpdateLiftInput) => Promise<Lift>
  markLiftDelivered: (id: string, input: MarkLiftDeliveredInput) => Promise<Lift>
  deleteLift: (id: string) => Promise<void>
  restoreLift: (id: string) => Promise<void>
  permanentlyDeleteLift: (id: string) => Promise<void>
  canDeleteLift: (id: string) => { ok: boolean; reason?: string }
  getOutstandingBalance: (poRef: string, soRef: string) => number
  getSellerOutstandingBalance: (sellerName: string) => { total: number; lines: { poRef: string; soRef: string; qtyMt: number }[] }
  getLiftsPending: () => Lift[]
  getLiftsDelivered: () => Lift[]
  getLiftsDeleted: () => Lift[]
  scheduleOrderDeletion: (id: string) => Promise<void>
  cancelOrderDeletion: (id: string) => Promise<void>
  permanentlyDeleteOrder: (id: string) => Promise<void>
  canDeleteOrder: (id: string) => { ok: boolean; reason?: string }
  getOrderByRef: (ref: string, side: OrderSide) => TradeOrder | undefined
  confirmCompanyLink: (input: ConfirmCompanyLinkInput) => Promise<Company>
  linkHighConfidenceCompany: (result: CompanyResolutionResult, type: CompanyType) => Promise<Company>
  addBroker: (input: AddBrokerInput) => Promise<Broker>
  updateBroker: (id: string, input: AddBrokerInput) => Promise<Broker>
  deleteBroker: (id: string) => Promise<void>
  canDeleteBroker: (id: string) => { ok: boolean; reason?: string }
  addProducer: (input: AddProducerInput) => Promise<Producer>
  updateProducer: (id: string, input: AddProducerInput) => Promise<Producer>
  deleteProducer: (id: string) => Promise<void>
  canDeleteProducer: (id: string) => { ok: boolean; reason?: string }
  addRetailer: (input: AddRetailerInput) => Promise<Retailer>
  updateRetailer: (id: string, input: AddRetailerInput) => Promise<Retailer>
  deleteRetailer: (id: string) => Promise<void>
  canDeleteRetailer: (id: string) => { ok: boolean; reason?: string }
  addItem: (name: string) => Promise<string>
  addSpot: (name: string) => Promise<string>
  getNextRef: (side: OrderSide) => string
  getPOPending: () => TradeOrder[]
  getSOPending: () => TradeOrder[]
  getPOCompleted: () => TradeOrder[]
  getSOCompleted: () => TradeOrder[]
  getPODeleted: () => TradeOrder[]
  getSODeleted: () => TradeOrder[]
  getPORegister: () => TradeOrder[]
  getSORegister: () => TradeOrder[]
  getLastOrder: (side: OrderSide) => TradeOrder | undefined
  getPOsAvailableForSO: (opts?: { includeRef?: string; itemName?: string }) => TradeOrder[]
  getRemainingSellQty: (poRef: string) => number
  getSOsForPO: (poRef: string) => TradeOrder[]
  revenueData: { month: string; purchase: number; sales: number }[]
  pipelineData: { stage: string; count: number; value: number }[]
}

const defaultData: TradeData = {
  tradeOrders: [],
  lifts: [],
  contracts: [],
  lots: [],
  payments: [],
  deliveries: [],
  brokers: [],
  producers: [],
  retailers: [],
  companies: [],
  activities: [],
  balanceSettlements: [],
  spots: [],
  items: [],
  counters: { po: 0, so: 0, lift: 0, invoice: 0 },
}

function coerceIsoDate(value: unknown, fallback = ''): string {
  const iso = normalizeDateToIso(value)
  if (iso) return iso
  const text = String(value ?? '').trim()
  return text || fallback
}

function normalizeTradeState(state: Partial<TradeData> | null | undefined): TradeData {
  if (!state || typeof state !== 'object') return { ...defaultData }
  const tradeOrders = (Array.isArray(state.tradeOrders) ? state.tradeOrders : []).map(order => {
    const coerced = {
      ...order,
      date: coerceIsoDate(order.date),
      deliveryPeriodStart: coerceIsoDate(order.deliveryPeriodStart, coerceIsoDate(order.date)),
      deliveryPeriodEnd: coerceIsoDate(order.deliveryPeriodEnd, coerceIsoDate(order.deliveryPeriodStart, coerceIsoDate(order.date))),
    }
    return repairAmbiguousTradeDates(coerced)
  })
  const lifts = (Array.isArray(state.lifts) ? state.lifts : []).map(lift => {
    const coerced = {
      ...lift,
      date: coerceIsoDate(lift.date),
      deliveredAt: lift.deliveredAt ? coerceIsoDate(lift.deliveredAt) || lift.deliveredAt : lift.deliveredAt,
      deliveryPeriodStart: lift.deliveryPeriodStart
        ? coerceIsoDate(lift.deliveryPeriodStart) || lift.deliveryPeriodStart
        : lift.deliveryPeriodStart,
      deliveryPeriodEnd: lift.deliveryPeriodEnd
        ? coerceIsoDate(lift.deliveryPeriodEnd) || lift.deliveryPeriodEnd
        : lift.deliveryPeriodEnd,
    }
    return repairAmbiguousTradeDates(coerced)
  })
  const lots = (Array.isArray(state.lots) ? state.lots : []).map(lot => ({
    ...lot,
    purchaseDate: coerceIsoDate(lot.purchaseDate, lot.purchaseDate),
  }))
  const next = {
    ...defaultData,
    ...state,
    tradeOrders,
    lifts,
    lots,
    contracts: Array.isArray(state.contracts) ? state.contracts : [],
    payments: Array.isArray(state.payments) ? state.payments : [],
    deliveries: Array.isArray(state.deliveries) ? state.deliveries : [],
    brokers: Array.isArray(state.brokers) ? state.brokers : [],
    producers: Array.isArray(state.producers) ? state.producers : [],
    retailers: Array.isArray(state.retailers) ? state.retailers : [],
    companies: Array.isArray(state.companies) ? state.companies : [],
    activities: Array.isArray(state.activities) ? state.activities : [],
    balanceSettlements: Array.isArray(state.balanceSettlements) ? state.balanceSettlements : [],
    spots: Array.isArray(state.spots) ? state.spots : [],
    items: Array.isArray(state.items) ? state.items : [],
    counters: { ...defaultData.counters, ...(state.counters ?? {}) },
  }
  return dedupeDirectory(refreshPartyLocationsFromOrders(next))
}

const TradeContext = createContext<TradeStoreValue | null>(null)

function monthKey(date: string) {
  return new Date(date).toLocaleString('en-US', { month: 'short' })
}

function getDeleteBlockReason(order: TradeOrder, orders: TradeOrder[], lifts: Lift[]): string | undefined {
  if (order.deleteScheduledAt) {
    return `Already in Deleted — restores until ${formatDeletionDate(order.deleteScheduledAt)}.`
  }
  if (order.liftedQty > 0) {
    return `This order has ${formatQty(order.liftedQty)} lifted. Remove lift records first.`
  }
  if (lifts.some(l => !l.deletedAt && liftTouchesRef(l, order.ref))) {
    return 'This order has lift records linked to it. Delete those lifts first.'
  }
  if (order.side === 'purchase') {
    const linkedSOs = getSOsForPO(orders, order.ref).filter(s => !s.deleteScheduledAt)
    if (linkedSOs.length > 0) {
      return `This PO has linked SO(s): ${linkedSOs.map(s => s.ref).join(', ')}. Delete those first.`
    }
  }
  return undefined
}

function TradeStoreLoading({ message }: { message?: string }) {
  return (
    <div className="flex h-viewport items-center justify-center bg-body">
      <div className="text-center space-y-3">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        <p className="text-sm text-muted">{message ?? 'Loading trade data…'}</p>
      </div>
    </div>
  )
}

function TradeStoreError({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { showIssue } = useServiceIssue()
  const isAuthError = /not authenticated|unauthorized/i.test(message)

  useEffect(() => {
    if (isAuthError) return
    showIssue(classifyUnknownError({ name: 'ApiError', message, status: 0 }))
  }, [isAuthError, message, showIssue])

  if (isAuthError) {
    return (
      <div className="flex h-viewport items-center justify-center bg-body p-6">
        <div className="max-w-md rounded-md bg-card shadow-[var(--shadow-card)] p-8 text-center space-y-4">
          <p className="text-sm text-heading font-medium">Your session expired</p>
          <p className="text-sm text-muted">Sign in again to continue.</p>
          <button
            type="button"
            onClick={() => window.location.assign('/login')}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover cursor-pointer"
          >
            Go to sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-viewport items-center justify-center bg-body p-6">
      <div className="max-w-md rounded-md bg-card shadow-[var(--shadow-card)] p-8 text-center space-y-4">
        <p className="text-sm font-medium text-heading">Could not load organisation data</p>
        {!SERVICE_ISSUE_UI_ENABLED ? (
          <p className="text-sm text-danger text-left whitespace-pre-wrap break-words">{message}</p>
        ) : (
          <p className="text-sm text-muted">Tradeal could not load your organisation data.</p>
        )}
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover cursor-pointer"
        >
          Try again
        </button>
      </div>
    </div>
  )
}

export function TradeProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const { session, organisationSandboxTools } = useAuth()
  const isPlatformAdminRoute = location.pathname.startsWith('/platform-admin')
  const skipTradeLoad = isPlatformAdminRoute || !!session?.isPlatformAdmin
  const tradeContextKey = `${session?.userId ?? ''}:${session?.organisationId ?? ''}:${session?.token?.slice(0, 8) ?? ''}`
  const loadSeq = useRef(0)
  const dateRepairPersistSeq = useRef(0)

  const [data, setData] = useState<TradeData>(defaultData)
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadState = useCallback(async (seedIfEmpty: boolean) => {
    const seq = ++loadSeq.current
    setLoading(true)
    setError(null)
    try {
      let state = await tradeApi.getState()
      if (
        seedIfEmpty &&
        organisationSandboxTools &&
        state.tradeOrders.length === 0 &&
        state.brokers.length === 0
      ) {
        try {
          const seeded = await tradeApi.seed()
          state = seeded.data
        } catch {
          // Demo seed requires an admin session.
        }
      }
      if (seq !== loadSeq.current) return
      const normalized = normalizeTradeState(state)
      setData(normalized)

      // Persist day/month swap repairs so Windows/Mac accounts converge after refresh.
      const prevOrders = new Map(state.tradeOrders.map(o => [o.id, o]))
      const prevLifts = new Map(state.lifts.map(l => [l.id, l]))
      const repaired =
        normalized.tradeOrders.some(order => {
          const prev = prevOrders.get(order.id)
          return (
            prev
            && (prev.date !== order.date
              || prev.deliveryPeriodStart !== order.deliveryPeriodStart
              || prev.deliveryPeriodEnd !== order.deliveryPeriodEnd)
          )
        })
        || normalized.lifts.some(lift => {
          const prev = prevLifts.get(lift.id)
          return (
            prev
            && (prev.date !== lift.date
              || prev.deliveryPeriodStart !== lift.deliveryPeriodStart
              || prev.deliveryPeriodEnd !== lift.deliveryPeriodEnd
              || prev.deliveredAt !== lift.deliveredAt)
          )
        })
      if (repaired) {
        const persistSeq = ++dateRepairPersistSeq.current
        void tradeApi
          .importState({ data: normalized })
          .then(response => {
            if (persistSeq !== dateRepairPersistSeq.current || seq !== loadSeq.current) return
            if (response?.data) setData(normalizeTradeState(response.data))
          })
          .catch(() => {
            // Import may require admin — in-memory repair still applies for this session.
          })
      }
    } catch (err) {
      if (seq !== loadSeq.current) return
      setError(err instanceof Error ? err.message : 'Could not load data from server')
    } finally {
      if (seq !== loadSeq.current) return
      setLoading(false)
      setReady(true)
    }
  }, [organisationSandboxTools])

  const refresh = useCallback(async () => {
    await loadState(false)
  }, [loadState])

  useEffect(() => {
    if (skipTradeLoad) {
      setLoading(false)
      setReady(true)
      return
    }
    if (!session?.token) {
      setLoading(false)
      setReady(true)
      return
    }
    void loadState(true)
  }, [loadState, session?.token, skipTradeLoad, tradeContextKey])

  const applyMutation = useCallback(async <T,>(fn: () => Promise<{ data: TradeData; result: T }>): Promise<T> => {
    const response = await fn()
    if (!response || typeof response !== 'object' || !response.data) {
      throw new Error('Server returned an invalid response')
    }
    const { data: next, result } = response
    setData(normalizeTradeState(next))
    if (typeof window !== 'undefined') {
      queueMicrotask(() => {
        window.dispatchEvent(new Event('tradeal-inbox-refresh'))
      })
    }
    return result
  }, [])

  const resetAll = useCallback(async () => {
    await applyMutation(() => tradeApi.reset())
  }, [applyMutation])

  const loadDemo = useCallback(async () => {
    await applyMutation(() => tradeApi.seed())
  }, [applyMutation])

  const importAll = useCallback(async (payload: { version?: number; data: TradeData }) => {
    const response = await tradeApi.importState(payload)
    if (!response?.data) {
      throw new Error('Server returned an invalid response')
    }
    const next = normalizeTradeState(response.data)
    setData(next)
    return next
  }, [])

  const createContract = useCallback(
    (input: Record<string, unknown>) => applyMutation(() => tradeApi.createContract(input)),
    [applyMutation],
  )

  const addOrder = useCallback(
    (input: CreateOrderInput) => applyMutation(() => tradeApi.createOrder(input as unknown as Record<string, unknown>)),
    [applyMutation],
  )

  const updateOrder = useCallback(
    (id: string, input: CreateOrderInput) =>
      applyMutation(() => tradeApi.updateOrder(id, input as unknown as Record<string, unknown>)),
    [applyMutation],
  )

  const buyBackPo = useCallback(
    (id: string, input: BuyBackInput) =>
      applyMutation(() => tradeApi.buyBackPo(id, input as unknown as Record<string, unknown>)),
    [applyMutation],
  )

  const closeOrder = useCallback(
    (id: string, input: { method: CloseOrderMethod; notes?: string; settledAt?: string }) =>
      applyMutation(() => tradeApi.closeOrder(id, input as unknown as Record<string, unknown>)),
    [applyMutation],
  )

  const addLift = useCallback(
    (input: CreateLiftInput) => applyMutation(() => tradeApi.createLift(input as unknown as Record<string, unknown>)),
    [applyMutation],
  )

  const updateLift = useCallback(
    (id: string, input: UpdateLiftInput) =>
      applyMutation(() => tradeApi.updateLift(id, input as unknown as Record<string, unknown>)),
    [applyMutation],
  )

  const markLiftDelivered = useCallback(
    (id: string, input: MarkLiftDeliveredInput) =>
      applyMutation(() => tradeApi.markLiftDelivered(id, input as unknown as Record<string, unknown>)),
    [applyMutation],
  )

  const deleteLift = useCallback(
    async (id: string) => {
      await applyMutation(() => tradeApi.deleteLift(id))
    },
    [applyMutation],
  )

  const restoreLift = useCallback(
    async (id: string) => {
      await applyMutation(() => tradeApi.restoreLift(id))
    },
    [applyMutation],
  )

  const permanentlyDeleteLift = useCallback(
    async (id: string) => {
      await applyMutation(() => tradeApi.permanentlyDeleteLift(id))
    },
    [applyMutation],
  )

  const scheduleOrderDeletion = useCallback(
    async (id: string) => {
      await applyMutation(() => tradeApi.scheduleOrderDeletion(id))
    },
    [applyMutation],
  )

  const cancelOrderDeletion = useCallback(
    async (id: string) => {
      await applyMutation(() => tradeApi.cancelOrderDeletion(id))
    },
    [applyMutation],
  )

  const permanentlyDeleteOrder = useCallback(
    async (id: string) => {
      await applyMutation(() => tradeApi.permanentlyDeleteOrder(id))
    },
    [applyMutation],
  )

  const confirmCompanyLink = useCallback(
    (input: ConfirmCompanyLinkInput) =>
      applyMutation(() => tradeApi.confirmCompanyLink(input as unknown as Record<string, unknown>)),
    [applyMutation],
  )

  const linkHighConfidenceCompany = useCallback(
    (result: CompanyResolutionResult, type: CompanyType) =>
      applyMutation(() => tradeApi.linkHighConfidenceCompany(result as unknown as Record<string, unknown>, type)),
    [applyMutation],
  )

  const addBroker = useCallback(
    (input: AddBrokerInput) => applyMutation(() => tradeApi.createBroker(input as unknown as Record<string, unknown>)),
    [applyMutation],
  )

  const updateBroker = useCallback(
    (id: string, input: AddBrokerInput) =>
      applyMutation(() => tradeApi.updateBroker(id, input as unknown as Record<string, unknown>)),
    [applyMutation],
  )

  const deleteBroker = useCallback(
    async (id: string) => {
      await applyMutation(() => tradeApi.deleteBroker(id))
    },
    [applyMutation],
  )

  const addProducer = useCallback(
    (input: AddProducerInput) =>
      applyMutation(() => tradeApi.createProducer(input as unknown as Record<string, unknown>)),
    [applyMutation],
  )

  const updateProducer = useCallback(
    (id: string, input: AddProducerInput) =>
      applyMutation(() => tradeApi.updateProducer(id, input as unknown as Record<string, unknown>)),
    [applyMutation],
  )

  const deleteProducer = useCallback(
    async (id: string) => {
      await applyMutation(() => tradeApi.deleteProducer(id))
    },
    [applyMutation],
  )

  const addRetailer = useCallback(
    (input: AddRetailerInput) =>
      applyMutation(() => tradeApi.createRetailer(input as unknown as Record<string, unknown>)),
    [applyMutation],
  )

  const updateRetailer = useCallback(
    (id: string, input: AddRetailerInput) =>
      applyMutation(() => tradeApi.updateRetailer(id, input as unknown as Record<string, unknown>)),
    [applyMutation],
  )

  const deleteRetailer = useCallback(
    async (id: string) => {
      await applyMutation(() => tradeApi.deleteRetailer(id))
    },
    [applyMutation],
  )

  const addItem = useCallback(
    (name: string) => applyMutation(() => tradeApi.createItem(name)),
    [applyMutation],
  )

  const addSpot = useCallback(
    (name: string) => applyMutation(() => tradeApi.createSpot(name)),
    [applyMutation],
  )

  const canDeleteOrder = useCallback((id: string) => {
    const order = data.tradeOrders.find(o => o.id === id)
    if (!order) return { ok: false, reason: 'Order not found' }
    const reason = getDeleteBlockReason(order, data.tradeOrders, data.lifts)
    return reason ? { ok: false, reason } : { ok: true }
  }, [data.tradeOrders, data.lifts])

  const canDeleteLift = useCallback((id: string) => {
    const lift = data.lifts.find(l => l.id === id)
    if (!lift) return { ok: false, reason: 'Lift not found' }
    if (lift.deletedAt) return { ok: false, reason: 'Lift is already in Deleted' }
    return { ok: true }
  }, [data.lifts])

  const canDeleteBroker = useCallback((id: string) => {
    const broker = data.brokers.find(b => b.id === id)
    if (!broker) return { ok: false, reason: 'Broker not found' }
    if (data.tradeOrders.some(o => o.brokerName === broker.name)) {
      return { ok: false, reason: 'Linked to one or more orders' }
    }
    return { ok: true }
  }, [data.brokers, data.tradeOrders])

  const canDeleteProducer = useCallback((id: string) => {
    const producer = data.producers.find(p => p.id === id)
    if (!producer) return { ok: false, reason: 'Producer not found' }
    if (data.tradeOrders.some(o => o.side === 'purchase' && o.partyName === producer.name)) {
      return { ok: false, reason: 'Linked to one or more purchase orders' }
    }
    if (data.lots.some(l => l.producer === producer.name)) {
      return { ok: false, reason: 'Linked to inventory lots' }
    }
    return { ok: true }
  }, [data.producers, data.tradeOrders, data.lots])

  const canDeleteRetailer = useCallback((id: string) => {
    const retailer = data.retailers.find(r => r.id === id)
    if (!retailer) return { ok: false, reason: 'Buyer not found' }
    if (data.tradeOrders.some(o => o.side === 'sale' && o.partyName === retailer.name)) {
      return { ok: false, reason: 'Linked to one or more sales orders' }
    }
    return { ok: true }
  }, [data.retailers, data.tradeOrders])

  const getNextRef = useCallback((side: OrderSide) => {
    const key = side === 'purchase' ? 'po' : 'so'
    const next = data.counters[key] + 1
    return side === 'purchase' ? formatPoRef(next) : formatSoRef(next)
  }, [data.counters])

  const getOrderByRef = useCallback(
    (ref: string, side: OrderSide) => {
      const needle = ref.trim()
      if (!needle) return undefined
      const exact = data.tradeOrders.find(o => o.side === side && o.ref === needle)
      if (exact) return exact
      const core = refCore(needle)
      if (!core) return undefined
      return data.tradeOrders.find(o => o.side === side && refCore(o.ref) === core)
    },
    [data.tradeOrders],
  )

  const getPOPending = useCallback(
    () => data.tradeOrders.filter(o => o.side === 'purchase' && o.status !== 'completed' && o.status !== 'cancelled' && !o.deleteScheduledAt),
    [data.tradeOrders],
  )

  const getSOPending = useCallback(
    () => data.tradeOrders.filter(o => o.side === 'sale' && o.status !== 'completed' && o.status !== 'cancelled' && !o.deleteScheduledAt),
    [data.tradeOrders],
  )

  const getPOCompleted = useCallback(
    () => data.tradeOrders.filter(o => o.side === 'purchase' && o.status === 'completed' && !o.deleteScheduledAt),
    [data.tradeOrders],
  )

  const getSOCompleted = useCallback(
    () => data.tradeOrders.filter(o => o.side === 'sale' && o.status === 'completed' && !o.deleteScheduledAt),
    [data.tradeOrders],
  )

  const getPODeleted = useCallback(
    () => data.tradeOrders.filter(o => o.side === 'purchase' && Boolean(o.deleteScheduledAt)),
    [data.tradeOrders],
  )

  const getSODeleted = useCallback(
    () => data.tradeOrders.filter(o => o.side === 'sale' && Boolean(o.deleteScheduledAt)),
    [data.tradeOrders],
  )

  const getLiftsPending = useCallback(
    () => data.lifts.filter(l => l.status === 'pending' && !l.deletedAt),
    [data.lifts],
  )

  const getLiftsDelivered = useCallback(
    () => data.lifts.filter(l => l.status === 'delivered' && !l.deletedAt),
    [data.lifts],
  )

  const getLiftsDeleted = useCallback(
    () => data.lifts.filter(l => Boolean(l.deletedAt)),
    [data.lifts],
  )

  const getOutstandingBalance = useCallback(
    (poRef: string, soRef: string) => calcOutstandingBalance(
      data.lifts.filter(l => !l.deletedAt),
      poRef,
      soRef,
      data.balanceSettlements ?? [],
    ),
    [data.lifts, data.balanceSettlements],
  )

  const getSellerOutstandingBalanceForParty = useCallback(
    (sellerName: string) => getSellerOutstandingBalance(
      data.lifts.filter(l => !l.deletedAt),
      data.tradeOrders,
      sellerName,
      data.balanceSettlements ?? [],
    ),
    [data.lifts, data.tradeOrders, data.balanceSettlements],
  )

  const getPORegister = useCallback(
    () => data.tradeOrders.filter(o => o.side === 'purchase' && !o.deleteScheduledAt),
    [data.tradeOrders],
  )

  const getSORegister = useCallback(
    () => data.tradeOrders.filter(o => o.side === 'sale' && !o.deleteScheduledAt),
    [data.tradeOrders],
  )

  const getLastOrder = useCallback(
    (side: OrderSide) => data.tradeOrders.filter(o => o.side === side).sort((a, b) => b.date.localeCompare(a.date))[0],
    [data.tradeOrders],
  )

  const getPOsAvailableForSO = useCallback(
    (opts?: { includeRef?: string; itemName?: string }) => {
      const includeRef = (opts?.includeRef || '').trim()
      const itemName = (opts?.itemName || '').trim().toLowerCase()
      const open = data.tradeOrders.filter(
        o =>
          o.side === 'purchase'
          && o.status !== 'cancelled'
          && o.status !== 'completed'
          && !o.deleteScheduledAt,
      )
      const withAvail = open.filter(o => {
        if (includeRef && o.ref === includeRef) return true
        return getRemainingSellQty(data.tradeOrders, o.ref, data.lifts) > 0
      })
      if (!itemName) return withAvail
      const sameItem = withAvail.filter(o => o.itemName.trim().toLowerCase() === itemName)
      return sameItem.length > 0 ? sameItem : withAvail
    },
    [data.tradeOrders, data.lifts],
  )

  const getRemainingSellQtyForPO = useCallback(
    (poRef: string) => getRemainingSellQty(data.tradeOrders, poRef, data.lifts),
    [data.tradeOrders, data.lifts],
  )

  const getSOsForPORef = useCallback(
    (poRef: string) => getSOsForPO(data.tradeOrders, poRef),
    [data.tradeOrders],
  )

  const revenueData = useMemo(() => {
    const map = new Map<string, { purchase: number; sales: number }>()
    for (const o of data.tradeOrders) {
      const m = monthKey(o.date)
      const cur = map.get(m) ?? { purchase: 0, sales: 0 }
      const value = o.orderQty * o.rate
      if (o.side === 'purchase') cur.purchase += value
      else cur.sales += value
      map.set(m, cur)
    }
    return Array.from(map.entries()).map(([month, v]) => ({ month, ...v }))
  }, [data.tradeOrders])

  const pipelineData = useMemo(() => {
    const poPending = data.tradeOrders.filter(o => o.side === 'purchase' && o.status === 'pending')
    const soPending = data.tradeOrders.filter(o => o.side === 'sale' && o.status === 'pending')
    const partial = data.tradeOrders.filter(o => o.status === 'partial')
    const completed = data.tradeOrders.filter(o => o.status === 'completed')
    return [
      { stage: 'PO Open', count: poPending.length, value: poPending.reduce((s, o) => s + o.orderQty * o.rate, 0) },
      { stage: 'SO Open', count: soPending.length, value: soPending.reduce((s, o) => s + o.orderQty * o.rate, 0) },
      { stage: 'Partial Lift', count: partial.length, value: partial.reduce((s, o) => s + toBeLifted(o) * o.rate, 0) },
      { stage: 'Completed', count: completed.length, value: completed.reduce((s, o) => s + o.orderQty * o.rate, 0) },
    ]
  }, [data.tradeOrders])

  const value: TradeStoreValue = {
    ...data,
    ready,
    loading,
    error,
    refresh,
    resetAll,
    loadDemo,
    importAll,
    createContract,
    addOrder,
    updateOrder,
    buyBackPo,
    closeOrder,
    addLift,
    updateLift,
    markLiftDelivered,
    deleteLift,
    restoreLift,
    permanentlyDeleteLift,
    getOutstandingBalance,
    getSellerOutstandingBalance: getSellerOutstandingBalanceForParty,
    scheduleOrderDeletion,
    cancelOrderDeletion,
    permanentlyDeleteOrder,
    canDeleteOrder,
    canDeleteLift,
    getOrderByRef,
    confirmCompanyLink,
    linkHighConfidenceCompany,
    addBroker,
    updateBroker,
    deleteBroker,
    canDeleteBroker,
    addProducer,
    updateProducer,
    deleteProducer,
    canDeleteProducer,
    addRetailer,
    updateRetailer,
    deleteRetailer,
    canDeleteRetailer,
    addItem,
    addSpot,
    getNextRef,
    getPOPending,
    getSOPending,
    getPOCompleted,
    getSOCompleted,
    getPODeleted,
    getSODeleted,
    getLiftsPending,
    getLiftsDelivered,
    getLiftsDeleted,
    getPORegister,
    getSORegister,
    getLastOrder,
    getPOsAvailableForSO,
    getRemainingSellQty: getRemainingSellQtyForPO,
    getSOsForPO: getSOsForPORef,
    revenueData,
    pipelineData,
  }

  if (!ready && loading && !skipTradeLoad) {
    return <TradeStoreLoading />
  }

  if (
    !skipTradeLoad &&
    error &&
    data.tradeOrders.length === 0 &&
    data.brokers.length === 0
  ) {
    return <TradeStoreError message={error} onRetry={() => void refresh()} />
  }

  return <TradeContext.Provider value={value}>{children}</TradeContext.Provider>
}

export function useTradeStore() {
  const ctx = useContext(TradeContext)
  if (!ctx) throw new Error('useTradeStore must be used within TradeProvider')
  return ctx
}

export async function resetTradeData() {
  const res = await tradeApi.reset()
  return res.data
}

export async function loadDemoData() {
  const res = await tradeApi.seed()
  return res.data
}
