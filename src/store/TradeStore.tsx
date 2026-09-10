import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  CURRENT_TRADER,
  type TradeOrder,
  type Lift,
  type LiftTanker,
  type Contract,
  type Lot,
  type Payment,
  type Delivery,
  type Broker,
  type Producer,
  type Retailer,
  type Company,
  type CompanyType,
  type Activity,
  type OrderSide,
  type DeliveryType,
  toBeLifted,
  formatDeliveryPeriod,
  getRemainingSellQty,
  getSOsForPO,
} from '../data/mockData'
import { buildSeedData } from '../data/seedData'
import { normalizeLiftTankers, resolveLiftQty } from '../lib/liftTankers'
import {
  normalizeCompanyName,
  type CompanyResolutionResult,
} from '../lib/companyResolution'
import { deletionDateFromNow, formatDeletionDate, isDeletionDue } from '../lib/orderDeletion'

const STORAGE_KEY = 'tradeos-data-v1'

interface TradeCounters {
  po: number
  so: number
  lift: number
  invoice: number
}

interface TradeData {
  tradeOrders: TradeOrder[]
  lifts: Lift[]
  contracts: Contract[]
  lots: Lot[]
  payments: Payment[]
  deliveries: Delivery[]
  brokers: Broker[]
  producers: Producer[]
  retailers: Retailer[]
  companies: Company[]
  activities: Activity[]
  spots: string[]
  items: string[]
  counters: TradeCounters
}

interface CreateOrderInput {
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
  unloading?: string
  remarks?: string
}

interface CreateLiftInput {
  poRef: string
  soRef: string
  date: string
  tankers: LiftTanker[]
  isSelfLift: boolean
}

type UpdateLiftInput = CreateLiftInput & {
  /** Only applicable when editing a delivered lift. */
  salesInvoiceNo?: string
}

interface MarkLiftDeliveredInput {
  tankers: LiftTanker[]
  deliveredAt?: string
}

interface AddBrokerInput {
  name: string
  email?: string
  phone?: string
}

interface AddProducerInput {
  name: string
  location?: string
  products?: string
}

interface AddRetailerInput {
  name: string
  location?: string
  products?: string
}

interface ConfirmCompanyLinkInput {
  extractedName: string
  companyId?: string
  officialName?: string
  type: CompanyType
  gst?: string
  location?: string
}

export interface TradeStoreValue extends TradeData {
  addOrder: (input: CreateOrderInput) => TradeOrder
  updateOrder: (id: string, input: CreateOrderInput) => TradeOrder
  addLift: (input: CreateLiftInput) => Lift
  updateLift: (id: string, input: UpdateLiftInput) => Lift
  markLiftDelivered: (id: string, input: MarkLiftDeliveredInput) => Lift
  getLiftsPending: () => Lift[]
  getLiftsDelivered: () => Lift[]
  scheduleOrderDeletion: (id: string) => void
  cancelOrderDeletion: (id: string) => void
  canDeleteOrder: (id: string) => { ok: boolean; reason?: string }
  getOrderByRef: (ref: string, side: OrderSide) => TradeOrder | undefined
  confirmCompanyLink: (input: ConfirmCompanyLinkInput) => Company
  linkHighConfidenceCompany: (result: CompanyResolutionResult, type: CompanyType) => Company
  addBroker: (input: AddBrokerInput) => Broker
  updateBroker: (id: string, input: AddBrokerInput) => Broker
  deleteBroker: (id: string) => void
  canDeleteBroker: (id: string) => { ok: boolean; reason?: string }
  addProducer: (input: AddProducerInput) => Producer
  updateProducer: (id: string, input: AddProducerInput) => Producer
  deleteProducer: (id: string) => void
  canDeleteProducer: (id: string) => { ok: boolean; reason?: string }
  addRetailer: (input: AddRetailerInput) => Retailer
  updateRetailer: (id: string, input: AddRetailerInput) => Retailer
  deleteRetailer: (id: string) => void
  canDeleteRetailer: (id: string) => { ok: boolean; reason?: string }
  addItem: (name: string) => string
  getNextRef: (side: OrderSide) => string
  getPOPending: () => TradeOrder[]
  getSOPending: () => TradeOrder[]
  getPOCompleted: () => TradeOrder[]
  getSOCompleted: () => TradeOrder[]
  getPORegister: () => TradeOrder[]
  getSORegister: () => TradeOrder[]
  getLastOrder: (side: OrderSide) => TradeOrder | undefined
  getPOsAvailableForSO: () => TradeOrder[]
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
  spots: [],
  items: [],
  counters: { po: 0, so: 0, lift: 0, invoice: 0 },
}

const TradeContext = createContext<TradeStoreValue | null>(null)

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function migrateCompanies(data: TradeData): TradeData {
  let companies = [...(data.companies ?? [])]

  for (const p of data.producers) {
    companies = upsertDirectoryCompany(companies, producerToCompany(p))
  }

  for (const r of data.retailers) {
    companies = upsertDirectoryCompany(companies, retailerToCompany(r))
  }

  return { ...data, companies }
}

function applyLiftTotals(data: TradeData): TradeData {
  const committedByRef = new Map<string, number>()
  const deliveredByRef = new Map<string, number>()
  for (const lift of data.lifts) {
    committedByRef.set(lift.poRef, (committedByRef.get(lift.poRef) ?? 0) + lift.liftedQty)
    committedByRef.set(lift.soRef, (committedByRef.get(lift.soRef) ?? 0) + lift.liftedQty)
    if ((lift.status ?? 'delivered') === 'delivered') {
      deliveredByRef.set(lift.poRef, (deliveredByRef.get(lift.poRef) ?? 0) + lift.liftedQty)
      deliveredByRef.set(lift.soRef, (deliveredByRef.get(lift.soRef) ?? 0) + lift.liftedQty)
    }
  }

  const tradeOrders = data.tradeOrders.map(o => {
    const committedLiftQty = committedByRef.get(o.ref) ?? 0
    const liftedQty = deliveredByRef.get(o.ref) ?? 0
    const updated = { ...o, committedLiftQty, liftedQty }
    return { ...updated, status: orderStatus(updated) }
  })

  return syncLotQuantities({ ...data, tradeOrders })
}

function formatSalesInvoiceNo(seq: number, year = new Date().getFullYear()): string {
  return `INV-${year}-${String(seq).padStart(4, '0')}`
}

function migrateCounters(counters: TradeCounters, lifts: Lift[]): TradeCounters {
  let invoice = counters.invoice ?? 0
  for (const lift of lifts) {
    const match = lift.salesInvoiceNo?.match(/^INV-\d{4}-(\d+)$/)
    if (match) invoice = Math.max(invoice, parseInt(match[1], 10))
  }
  return { ...counters, invoice }
}

function migrateLifts(data: TradeData): TradeData {
  const lifts = data.lifts.map(lift => {
    const status = lift.status ?? 'delivered'
    const withStatus = {
      ...lift,
      status,
      salesInvoiceNo: status === 'delivered' ? lift.salesInvoiceNo : undefined,
    }
    if (lift.tankers?.length) {
      const tankers = lift.tankers.map((t, _, arr) => ({
        ...t,
        lrNo: t.lrNo ?? '',
        actualQtyMt: t.actualQtyMt ?? (arr.length === 1 ? lift.liftedQty : undefined),
      }))
      return { ...withStatus, tankers, liftedQty: resolveLiftQty(tankers) || lift.liftedQty }
    }
    if (lift.tankerNo) {
      const tankers = [{
        tankerNo: lift.tankerNo,
        transportName: '',
        driverMobile: '',
        lrNo: '',
        actualQtyMt: lift.liftedQty,
      }]
      return { ...withStatus, tankers }
    }
    return { ...withStatus, tankers: [] }
  })
  return applyLiftTotals({ ...data, lifts, counters: migrateCounters(data.counters, lifts) })
}

function producerToCompany(producer: Producer): Company {
  return {
    id: producer.id,
    officialName: producer.name,
    aliases: [],
    types: ['seller'],
    location: producer.location,
  }
}

function retailerToCompany(retailer: Retailer): Company {
  return {
    id: retailer.id,
    officialName: retailer.name,
    aliases: [],
    types: ['buyer'],
    location: retailer.location,
  }
}

function upsertDirectoryCompany(companies: Company[], company: Company): Company[] {
  const idx = companies.findIndex(c => c.id === company.id)
  if (idx < 0) return [...companies, company]

  const existing = companies[idx]
  const types = Array.from(new Set([...existing.types, ...company.types])) as CompanyType[]
  return companies.map((c, i) => i === idx
    ? {
        ...existing,
        officialName: company.officialName,
        location: company.location ?? existing.location,
        types,
      }
    : c)
}

function removeDirectoryCompany(companies: Company[], id: string, type: CompanyType): Company[] {
  const existing = companies.find(c => c.id === id)
  if (!existing) return companies

  const remainingTypes = existing.types.filter(t => t !== type)
  if (remainingTypes.length === 0) {
    return companies.filter(c => c.id !== id)
  }

  return companies.map(c => c.id === id ? { ...c, types: remainingTypes } : c)
}

function aliasKey(name: string): string {
  return normalizeCompanyName(name)
}

function shouldStoreAlias(officialName: string, extractedName: string, aliases: string[]): boolean {
  const trimmed = extractedName.trim()
  if (!trimmed) return false
  if (normalizeCompanyName(trimmed) === normalizeCompanyName(officialName)) return false
  return !aliases.some(a => aliasKey(a) === aliasKey(trimmed))
}

function syncProducerRetailerFromCompany(
  prev: TradeData,
  company: Company,
  itemName?: string,
  rate?: number,
): Pick<TradeData, 'producers' | 'retailers'> {
  let producers = prev.producers
  let retailers = prev.retailers

  if (company.types.includes('seller') || company.types.includes('both')) {
    const exists = producers.some(p => p.id === company.id || p.name === company.officialName)
    if (!exists) {
      producers = [...producers, {
        id: company.id,
        name: company.officialName,
        location: company.location ?? '',
        products: itemName ? [itemName] : [],
        contracts: 0,
        avgRate: rate ?? 0,
        rating: 0,
      }]
    }
  }

  if (company.types.includes('buyer') || company.types.includes('both')) {
    const exists = retailers.some(r => r.id === company.id || r.name === company.officialName)
    if (!exists) {
      retailers = [...retailers, {
        id: company.id,
        name: company.officialName,
        location: company.location ?? '',
        products: itemName ? [itemName] : [],
        totalPurchases: 0,
        outstanding: 0,
        lastOrder: '',
      }]
    }
  }

  return { producers, retailers }
}

function loadData(): TradeData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      return purgeDueOrderDeletions(syncLotQuantities(ensureLotsForPOs(migrateLifts(migrateCompanies({ ...defaultData, ...JSON.parse(raw) })))))
    }
  } catch { /* ignore */ }
  const seed = buildSeedData()
  return purgeDueOrderDeletions(syncLotQuantities(ensureLotsForPOs(migrateLifts(migrateCompanies({
    ...defaultData,
    ...seed,
  })))))
}

function saveData(data: TradeData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

function orderCommission(order: TradeOrder): number {
  if (order.brokeragePerTon != null && order.brokeragePerTon > 0) {
    return order.orderQty * order.brokeragePerTon
  }
  return order.orderQty * order.rate * (order.brokeragePct / 100)
}

function orderStatus(order: TradeOrder): TradeOrder['status'] {
  if (order.liftedQty >= order.orderQty) return 'completed'
  if (order.liftedQty > 0) return 'partial'
  return 'pending'
}

function upsertString(list: string[], value: string): string[] {
  const trimmed = value.trim()
  if (!trimmed || list.includes(trimmed)) return list
  return [...list, trimmed]
}

function parseProducts(products?: string): string[] {
  if (!products) return []
  return products.split(',').map(p => p.trim()).filter(Boolean)
}

function monthKey(date: string) {
  const d = new Date(date)
  return d.toLocaleString('en-US', { month: 'short' })
}

function lotNumberForPO(poRef: string) {
  return `LOT-${poRef}`
}

function buildLotFromPO(po: TradeOrder): Lot {
  return {
    id: uid(),
    lotNumber: lotNumberForPO(po.ref),
    commodity: po.itemName,
    purchasePrice: po.rate,
    quantityPurchased: po.orderQty,
    remaining: po.orderQty,
    allocated: 0,
    available: po.orderQty,
    unit: po.unit,
    producer: po.partyName,
    broker: po.brokerName,
    purchaseDate: po.date,
    contractId: po.id,
    margin: 0,
  }
}

function syncLotQuantities(data: TradeData): TradeData {
  const lots = data.lots.map(lot => {
    const poRef = lot.lotNumber.replace(/^LOT-/, '')
    const po = data.tradeOrders.find(o => o.ref === poRef && o.side === 'purchase')
    if (!po) return lot

    const linkedSOs = getSOsForPO(data.tradeOrders, poRef)
    const allocated = linkedSOs.reduce((s, o) => s + o.orderQty, 0)
    const avgSoRate = linkedSOs.length
      ? linkedSOs.reduce((sum, o) => sum + o.rate, 0) / linkedSOs.length
      : 0
    const margin = avgSoRate > po.rate ? ((avgSoRate - po.rate) / po.rate) * 100 : lot.margin

    return {
      ...lot,
      commodity: po.itemName,
      purchasePrice: po.rate,
      quantityPurchased: po.orderQty,
      remaining: Math.max(0, po.orderQty - po.liftedQty),
      allocated,
      available: Math.max(0, po.orderQty - allocated),
      producer: po.partyName,
      broker: po.brokerName,
      purchaseDate: po.date,
      margin,
    }
  })
  return { ...data, lots }
}

function ensureLotsForPOs(data: TradeData): TradeData {
  const missing = data.tradeOrders.filter(
    o => o.side === 'purchase' && !data.lots.some(l => l.lotNumber === lotNumberForPO(o.ref))
  )
  if (missing.length === 0) return data
  let lots = [...data.lots]
  for (const po of missing) {
    const linkedSOs = getSOsForPO(data.tradeOrders, po.ref)
    const allocated = linkedSOs.reduce((s, o) => s + o.orderQty, 0)
    lots = [...lots, {
      ...buildLotFromPO(po),
      allocated,
      available: Math.max(0, po.orderQty - allocated),
      remaining: Math.max(0, po.orderQty - po.liftedQty),
    }]
  }
  return { ...data, lots }
}

function getDeleteBlockReason(order: TradeOrder, orders: TradeOrder[], lifts: Lift[]): string | undefined {
  if (order.deleteScheduledAt) {
    return `Deletion already scheduled for ${formatDeletionDate(order.deleteScheduledAt)}.`
  }
  if (order.liftedQty > 0) {
    return `This order has ${order.liftedQty.toFixed(3)} MT lifted. Remove lift records first.`
  }
  if (lifts.some(l => l.poRef === order.ref || l.soRef === order.ref)) {
    return 'This order has lift records linked to it. Delete those lifts first.'
  }
  if (order.side === 'purchase') {
    const linkedSOs = getSOsForPO(orders, order.ref)
    if (linkedSOs.length > 0) {
      return `This PO has linked SO(s): ${linkedSOs.map(s => s.ref).join(', ')}. Delete those first.`
    }
  }
  return undefined
}

function applyRemoveOrder(data: TradeData, id: string): TradeData {
  const order = data.tradeOrders.find(o => o.id === id)
  if (!order) return data

  let lots = data.lots
  if (order.side === 'purchase') {
    lots = lots.filter(l => l.lotNumber !== lotNumberForPO(order.ref))
  } else if (order.poRef) {
    const lotNo = lotNumberForPO(order.poRef)
    lots = lots.map(l => l.lotNumber === lotNo
      ? {
        ...l,
        allocated: Math.max(0, l.allocated - order.orderQty),
        available: l.available + order.orderQty,
      }
      : l)
  }

  return {
    ...data,
    tradeOrders: data.tradeOrders.filter(o => o.id !== id),
    lots,
    activities: [{
      id: uid(),
      type: 'order_deleted',
      title: order.side === 'purchase' ? 'PO deleted' : 'SO deleted',
      description: `${order.ref} — ${order.orderQty} MT ${order.itemName} with ${order.partyName}`,
      timestamp: new Date().toISOString(),
      user: CURRENT_TRADER,
      entityRef: order.ref,
    }, ...data.activities],
  }
}

function purgeDueOrderDeletions(data: TradeData): TradeData {
  let next = data
  for (const order of data.tradeOrders) {
    if (order.deleteScheduledAt && isDeletionDue(order.deleteScheduledAt)) {
      next = applyRemoveOrder(next, order.id)
    }
  }
  return next
}

function buildOrderFromInput(
  input: CreateOrderInput,
  snapshot: TradeData,
  existing?: TradeOrder,
): TradeOrder {
  const sellerCompany = input.sellerCompanyId
    ? snapshot.companies.find(c => c.id === input.sellerCompanyId)
    : undefined
  const buyerCompany = input.buyerCompanyId
    ? snapshot.companies.find(c => c.id === input.buyerCompanyId)
    : undefined
  const partyCompany = input.partyCompanyId
    ? snapshot.companies.find(c => c.id === input.partyCompanyId)
    : undefined

  const resolvedPartyName = partyCompany?.officialName ?? input.partyName.trim()
  const resolvedSellerName = sellerCompany?.officialName ?? input.sellerName?.trim()
  const resolvedBuyerName = buyerCompany?.officialName ?? input.buyerName?.trim()

  return {
    id: existing?.id ?? uid(),
    ref: existing?.ref ?? input.ref?.trim() ?? '',
    side: input.side,
    poRef: input.side === 'sale' ? (input.poRef?.trim() || undefined) : undefined,
    brokerContractRef: input.brokerContractRef,
    date: input.date,
    partyName: resolvedPartyName,
    partyCompanyId: input.partyCompanyId,
    sellerCompanyId: input.sellerCompanyId,
    buyerCompanyId: input.buyerCompanyId,
    extractedPartyName: input.extractedPartyName,
    extractedSellerName: input.extractedSellerName,
    extractedBuyerName: input.extractedBuyerName,
    itemName: input.itemName.trim(),
    spot: input.spot.trim(),
    deliveryType: input.deliveryType,
    deliveryPeriodStart: input.deliveryPeriodStart,
    deliveryPeriodEnd: input.deliveryPeriodEnd,
    deliveryPeriodVerified: input.deliveryPeriodVerified ?? existing?.deliveryPeriodVerified ?? false,
    rate: input.rate,
    taxRate: input.taxRate,
    orderQty: input.orderQty,
    liftedQty: existing?.liftedQty ?? 0,
    committedLiftQty: existing?.committedLiftQty ?? existing?.liftedQty ?? 0,
    unit: 'MT',
    brokerName: input.brokerName.trim(),
    brokeragePct: input.brokeragePct,
    brokeragePerTon: input.brokeragePerTon,
    sellerName: resolvedSellerName,
    buyerName: resolvedBuyerName,
    partyConfirmedBy: input.partyConfirmedBy?.trim(),
    sellerConfirmedBy: input.sellerConfirmedBy?.trim(),
    buyerConfirmedBy: input.buyerConfirmedBy?.trim(),
    contractRateDisplay: input.contractRateDisplay,
    sellerGst: input.sellerGst,
    buyerGst: input.buyerGst,
    brand: input.brand?.trim(),
    rateBasis: input.rateBasis,
    ratePerBasis: input.ratePerBasis,
    paymentTerms: input.paymentTerms?.trim(),
    unloading: input.unloading?.trim(),
    remarks: input.remarks?.trim(),
    status: existing ? orderStatus({ ...existing, orderQty: input.orderQty, liftedQty: existing.liftedQty }) : 'pending',
    deleteScheduledAt: existing?.deleteScheduledAt,
  }
}

export function TradeProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<TradeData>(loadData)

  useEffect(() => {
    saveData(data)
  }, [data])

  useEffect(() => {
    setData(prev => purgeDueOrderDeletions(prev))
  }, [])

  const getNextRef = useCallback((side: OrderSide) => {
    const key = side === 'purchase' ? 'po' : 'so'
    const next = data.counters[key] + 1
    return side === 'purchase' ? `PO-${next}` : `SO-${next}`
  }, [data.counters])

  const confirmCompanyLink = useCallback((input: ConfirmCompanyLinkInput): Company => {
    const extracted = input.extractedName.trim()
    if (!extracted) throw new Error('Extracted company name is required')

    let company: Company

    if (input.companyId) {
      const existing = data.companies.find(c => c.id === input.companyId)
      if (!existing) throw new Error('Company not found')
      const aliases = shouldStoreAlias(existing.officialName, extracted, existing.aliases)
        ? [...existing.aliases, extracted]
        : existing.aliases
      const types = existing.types.includes(input.type)
        ? existing.types
        : [...existing.types, input.type]
      company = {
        ...existing,
        aliases,
        types,
        gst: input.gst ?? existing.gst,
        location: input.location?.trim() || existing.location,
      }
      setData(prev => ({
        ...prev,
        companies: prev.companies.map(c => c.id === company.id ? company : c),
        ...syncProducerRetailerFromCompany(prev, company),
      }))
    } else {
      const officialName = (input.officialName ?? extracted).trim()
      if (!officialName) throw new Error('Official company name is required')
      if (data.companies.some(c => normalizeCompanyName(c.officialName) === normalizeCompanyName(officialName))) {
        throw new Error('A company with this official name already exists')
      }
      company = {
        id: uid(),
        officialName,
        aliases: shouldStoreAlias(officialName, extracted, []) ? [extracted] : [],
        types: [input.type],
        gst: input.gst,
        location: input.location?.trim() || undefined,
      }
      setData(prev => ({
        ...prev,
        companies: [...prev.companies, company],
        ...syncProducerRetailerFromCompany(prev, company),
      }))
    }

    return company
  }, [data.companies])

  const linkHighConfidenceCompany = useCallback((result: CompanyResolutionResult, type: CompanyType): Company => {
    if (!result.match || result.confidence !== 'high') {
      throw new Error('No high-confidence company match')
    }
    return confirmCompanyLink({
      extractedName: result.extractedName,
      companyId: result.match.company.id,
      type,
    })
  }, [confirmCompanyLink])

  const addOrder = useCallback((input: CreateOrderInput): TradeOrder => {
    const snapshot = data
    const key = input.side === 'purchase' ? 'po' : 'so'
    const counterNext = snapshot.counters[key] + 1
    const ref = input.ref?.trim() || (input.side === 'purchase' ? `PO-${counterNext}` : `SO-${counterNext}`)

    const poRef = input.side === 'sale' ? input.poRef?.trim() : undefined
    if (input.side === 'sale' && poRef) {
      const po = snapshot.tradeOrders.find(o => o.ref === poRef && o.side === 'purchase')
      if (!po) throw new Error('Linked PO not found')
      const remaining = getRemainingSellQty(snapshot.tradeOrders, poRef)
      if (input.orderQty > remaining) {
        throw new Error(`SO qty cannot exceed ${remaining.toFixed(3)} MT available on ${po.ref}`)
      }
    }

    const order: TradeOrder = {
      ...buildOrderFromInput(input, snapshot),
      ref,
      liftedQty: 0,
      committedLiftQty: 0,
      status: 'pending',
      deleteScheduledAt: undefined,
    }

    setData(prev => {
      let producers = prev.producers
      let retailers = prev.retailers
      let lots = prev.lots
      let companies = prev.companies

      const touchCompany = (companyId: string | undefined) => {
        if (!companyId) return
        const company = companies.find(c => c.id === companyId)
        if (!company) return
        const synced = syncProducerRetailerFromCompany(
          { ...prev, producers, retailers, companies },
          company,
          order.itemName,
          order.rate,
        )
        producers = synced.producers
        retailers = synced.retailers
      }

      touchCompany(order.partyCompanyId)
      touchCompany(order.sellerCompanyId)
      touchCompany(order.buyerCompanyId)

      if (input.side === 'purchase') {
        const exists = producers.some(p => p.name === order.partyName)
        if (!exists && order.partyName) {
          producers = [...producers, {
            id: uid(),
            name: order.partyName,
            location: order.spot,
            products: [order.itemName],
            contracts: 1,
            avgRate: order.rate,
            rating: 0,
          }]
        } else if (exists) {
          producers = producers.map(p => p.name === order.partyName
            ? { ...p, contracts: p.contracts + 1, products: upsertString(p.products, order.itemName) }
            : p)
        }
        lots = [...lots, buildLotFromPO(order)]
      } else {
        const exists = retailers.some(r => r.name === order.partyName)
        if (!exists && order.partyName) {
          retailers = [...retailers, {
            id: uid(),
            name: order.partyName,
            location: order.spot,
            totalPurchases: order.orderQty * order.rate,
            outstanding: 0,
            products: [order.itemName],
            lastOrder: order.date,
          }]
        } else if (exists) {
          retailers = retailers.map(r => r.name === order.partyName
            ? {
              ...r,
              totalPurchases: r.totalPurchases + order.orderQty * order.rate,
              products: upsertString(r.products, order.itemName),
              lastOrder: order.date,
            }
            : r)
        }
        if (order.poRef) {
          const lotNo = lotNumberForPO(order.poRef)
          if (!lots.some(l => l.lotNumber === lotNo)) {
            const po = prev.tradeOrders.find(o => o.ref === order.poRef)!
            lots = [...lots, buildLotFromPO(po)]
          }
          lots = lots.map(l => l.lotNumber === lotNo ? {
            ...l,
            allocated: l.allocated + order.orderQty,
            available: Math.max(0, l.available - order.orderQty),
            margin: order.rate > l.purchasePrice
              ? ((order.rate - l.purchasePrice) / l.purchasePrice) * 100
              : l.margin,
          } : l)
        }
      }

      return {
        ...prev,
        tradeOrders: [...prev.tradeOrders, order],
        producers,
        retailers,
        lots,
        spots: upsertString(prev.spots, order.spot),
        items: upsertString(prev.items, order.itemName),
        brokers: order.brokerName.trim()
          ? (() => {
              const exists = prev.brokers.some(b => b.name === order.brokerName)
              if (exists) {
                return prev.brokers.map(b => b.name === order.brokerName
                  ? { ...b, contracts: b.contracts + 1, commissionEarned: b.commissionEarned + orderCommission(order) }
                  : b)
              }
              return [...prev.brokers, {
                id: uid(),
                name: order.brokerName,
                email: '',
                phone: '',
                contracts: 1,
                commissionEarned: orderCommission(order),
                successRate: 100,
                network: 1,
              }]
            })()
          : prev.brokers,
        counters: { ...prev.counters, [key]: counterNext },
        activities: [{
          id: uid(),
          type: input.side === 'purchase' ? 'po_created' : 'so_created',
          title: input.side === 'purchase' ? 'PO created' : 'SO created',
          description: input.side === 'purchase'
            ? `${ref} — ${order.orderQty} MT ${order.itemName} @ ₹${order.rate}/MT with ${order.partyName}`
            : order.poRef
              ? `${ref} against ${order.poRef} — ${order.orderQty} MT to ${order.partyName} @ ₹${order.rate}/MT`
              : `${ref} — ${order.orderQty} MT to ${order.partyName} @ ₹${order.rate}/MT (no PO linked yet)`,
          timestamp: new Date().toISOString(),
          user: CURRENT_TRADER,
          entityRef: ref,
        }, ...prev.activities],
      }
    })

    return order
  }, [data])

  const updateOrder = useCallback((id: string, input: CreateOrderInput): TradeOrder => {
    const existing = data.tradeOrders.find(o => o.id === id)
    if (!existing) throw new Error('Order not found')
    if (existing.side !== input.side) throw new Error('Cannot change order type')
    if (input.orderQty < existing.liftedQty) {
      throw new Error(`Quantity cannot be less than lifted qty (${existing.liftedQty.toFixed(3)} MT)`)
    }

    const resolvedPoRef = existing.poRef ?? (input.poRef?.trim() || undefined)

    if (input.side === 'sale' && resolvedPoRef) {
      const po = data.tradeOrders.find(o => o.ref === resolvedPoRef && o.side === 'purchase')
      if (!po) throw new Error('Linked PO not found')
      const remaining = getRemainingSellQty(data.tradeOrders, resolvedPoRef)
        + (existing.poRef === resolvedPoRef ? existing.orderQty : 0)
      if (input.orderQty > remaining) {
        throw new Error(`SO qty cannot exceed ${remaining.toFixed(3)} MT available on ${po.ref}`)
      }
    }

    const updated = buildOrderFromInput(input, data, existing)
    updated.ref = existing.ref
    updated.poRef = resolvedPoRef
    updated.id = existing.id

    setData(prev => {
      let lots = prev.lots
      const qtyDelta = updated.orderQty - existing.orderQty

      if (updated.side === 'purchase') {
        const lotNo = lotNumberForPO(updated.ref)
        lots = lots.map(l => l.lotNumber === lotNo
          ? {
            ...l,
            commodity: updated.itemName,
            purchasePrice: updated.rate,
            quantityPurchased: updated.orderQty,
            remaining: Math.max(0, updated.orderQty - updated.liftedQty),
            available: Math.max(0, updated.orderQty - l.allocated),
            producer: updated.partyName,
            broker: updated.brokerName,
            purchaseDate: updated.date,
          }
          : l)
      } else if (updated.poRef) {
        const lotNo = lotNumberForPO(updated.poRef)
        if (!existing.poRef) {
          if (!lots.some(l => l.lotNumber === lotNo)) {
            const po = prev.tradeOrders.find(o => o.ref === updated.poRef)!
            lots = [...lots, buildLotFromPO(po)]
          }
          lots = lots.map(l => l.lotNumber === lotNo ? {
            ...l,
            allocated: l.allocated + updated.orderQty,
            available: Math.max(0, l.available - updated.orderQty),
            margin: updated.rate > l.purchasePrice
              ? ((updated.rate - l.purchasePrice) / l.purchasePrice) * 100
              : l.margin,
          } : l)
        } else if (qtyDelta !== 0) {
          lots = lots.map(l => l.lotNumber === lotNo ? {
            ...l,
            allocated: l.allocated + qtyDelta,
            available: Math.max(0, l.available - qtyDelta),
            margin: updated.rate > l.purchasePrice
              ? ((updated.rate - l.purchasePrice) / l.purchasePrice) * 100
              : l.margin,
          } : l)
        }
      }

      return {
        ...prev,
        tradeOrders: prev.tradeOrders.map(o => o.id === id ? updated : o),
        lots,
        spots: upsertString(prev.spots, updated.spot),
        items: upsertString(prev.items, updated.itemName),
        activities: [{
          id: uid(),
          type: 'order_updated',
          title: updated.side === 'purchase' ? 'PO updated' : 'SO updated',
          description: `${updated.ref} — ${updated.orderQty} MT ${updated.itemName}`,
          timestamp: new Date().toISOString(),
          user: CURRENT_TRADER,
          entityRef: updated.ref,
        }, ...prev.activities],
      }
    })

    return updated
  }, [data])

  const addLift = useCallback((input: CreateLiftInput): Lift => {
    const po = data.tradeOrders.find(o => o.ref === input.poRef)
    const so = data.tradeOrders.find(o => o.ref === input.soRef)
    if (!po || !so) throw new Error('PO or SO not found')
    if (so.poRef && so.poRef !== po.ref) {
      throw new Error(`${so.ref} is linked to ${so.poRef}, not ${po.ref}`)
    }

    const tankers = normalizeLiftTankers(input.tankers)
    const liftedQty = resolveLiftQty(tankers)
    if (liftedQty <= 0) throw new Error('Enter planned quantity for at least one tanker')

    const maxQty = Math.min(toBeLifted(po), toBeLifted(so))
    if (liftedQty > maxQty) {
      throw new Error(`Lift qty cannot exceed ${maxQty.toFixed(3)} MT remaining on this PO/SO pair`)
    }

    const liftRef = data.counters.lift + 1
    const lift: Lift = {
      id: uid(),
      liftRef,
      poRef: input.poRef,
      soRef: input.soRef,
      date: input.date,
      status: 'pending',
      buyerName: so.partyName,
      sellerName: po.partyName,
      itemName: po.itemName,
      deliveryPeriod: formatDeliveryPeriod(po),
      deliveryPeriodStart: po.deliveryPeriodStart,
      deliveryPeriodEnd: po.deliveryPeriodEnd,
      deliveryPeriodVerified: po.deliveryPeriodVerified,
      rate: so.rate,
      liftedQty,
      tankerNo: tankers[0]?.tankerNo ?? '',
      tankers,
      isSelfLift: input.isSelfLift,
    }

    setData(prev => applyLiftTotals({
      ...prev,
      lifts: [...prev.lifts, lift],
      counters: { ...prev.counters, lift: liftRef },
      activities: [{
        id: uid(),
        type: 'lift_recorded',
        title: 'Lift recorded',
        description: `Lift #${liftRef} — ${liftedQty.toFixed(3)} MT planned · in transit (${input.poRef} → ${input.soRef})`,
        timestamp: new Date().toISOString(),
        user: CURRENT_TRADER,
        entityRef: `Lift-${liftRef}`,
      }, ...prev.activities],
    }))

    return lift
  }, [data.tradeOrders, data.counters.lift])

  const updateLift = useCallback((id: string, input: UpdateLiftInput): Lift => {
    const existing = data.lifts.find(l => l.id === id)
    if (!existing) throw new Error('Lift not found')

    const po = data.tradeOrders.find(o => o.ref === existing.poRef)
    const so = data.tradeOrders.find(o => o.ref === existing.soRef)
    if (!po || !so) throw new Error('PO or SO not found')

    const tankers = normalizeLiftTankers(input.tankers)
    const liftedQty = resolveLiftQty(tankers)
    const qtyLabel = existing.status === 'delivered' ? 'actual weighed quantity' : 'planned quantity'
    if (liftedQty <= 0) throw new Error(`Enter ${qtyLabel} for at least one tanker`)

    const otherPoCommitted = data.lifts
      .filter(l => l.poRef === existing.poRef && l.id !== id)
      .reduce((sum, l) => sum + l.liftedQty, 0)
    const otherSoCommitted = data.lifts
      .filter(l => l.soRef === existing.soRef && l.id !== id)
      .reduce((sum, l) => sum + l.liftedQty, 0)
    const maxQty = Math.min(po.orderQty - otherPoCommitted, so.orderQty - otherSoCommitted)
    if (liftedQty > maxQty) {
      throw new Error(`Lift qty cannot exceed ${maxQty.toFixed(3)} MT remaining on this PO/SO pair`)
    }

    const updated: Lift = {
      ...existing,
      date: input.date,
      liftedQty,
      tankerNo: tankers[0]?.tankerNo ?? '',
      tankers,
      isSelfLift: input.isSelfLift,
      ...(existing.status === 'delivered' && input.salesInvoiceNo !== undefined
        ? { salesInvoiceNo: input.salesInvoiceNo.trim() || existing.salesInvoiceNo }
        : {}),
    }

    setData(prev => applyLiftTotals({
      ...prev,
      lifts: prev.lifts.map(l => (l.id === id ? updated : l)),
      activities: [{
        id: uid(),
        type: 'lift_recorded',
        title: 'Lift quantity updated',
        description: `Lift #${updated.liftRef} — ${liftedQty.toFixed(3)} MT actual (${existing.poRef} → ${existing.soRef})`,
        timestamp: new Date().toISOString(),
        user: CURRENT_TRADER,
        entityRef: `Lift-${updated.liftRef}`,
      }, ...prev.activities],
    }))

    return updated
  }, [data.lifts, data.tradeOrders])

  const markLiftDelivered = useCallback((id: string, input: MarkLiftDeliveredInput): Lift => {
    const existing = data.lifts.find(l => l.id === id)
    if (!existing) throw new Error('Lift not found')
    if (existing.status === 'delivered') throw new Error('Lift is already delivered')

    const po = data.tradeOrders.find(o => o.ref === existing.poRef)
    const so = data.tradeOrders.find(o => o.ref === existing.soRef)
    if (!po || !so) throw new Error('PO or SO not found')

    const tankers = normalizeLiftTankers(input.tankers)
    const liftedQty = resolveLiftQty(tankers)
    if (liftedQty <= 0) throw new Error('Enter actual weighed quantity for at least one tanker')

    const otherPoCommitted = data.lifts
      .filter(l => l.poRef === existing.poRef && l.id !== id)
      .reduce((sum, l) => sum + l.liftedQty, 0)
    const otherSoCommitted = data.lifts
      .filter(l => l.soRef === existing.soRef && l.id !== id)
      .reduce((sum, l) => sum + l.liftedQty, 0)
    const maxQty = Math.min(po.orderQty - otherPoCommitted, so.orderQty - otherSoCommitted)
    if (liftedQty > maxQty) {
      throw new Error(`Actual qty cannot exceed ${maxQty.toFixed(3)} MT remaining on this PO/SO pair`)
    }

    const deliveredAt = input.deliveredAt ?? new Date().toISOString()
    const invoiceSeq = data.counters.invoice + 1
    const salesInvoiceNo = formatSalesInvoiceNo(invoiceSeq, new Date(deliveredAt).getFullYear())
    const updated: Lift = {
      ...existing,
      status: 'delivered',
      deliveredAt,
      salesInvoiceNo,
      liftedQty,
      tankerNo: tankers[0]?.tankerNo ?? '',
      tankers,
    }

    setData(prev => applyLiftTotals({
      ...prev,
      lifts: prev.lifts.map(l => (l.id === id ? updated : l)),
      counters: { ...prev.counters, invoice: invoiceSeq },
      activities: [{
        id: uid(),
        type: 'lift_recorded',
        title: 'Lift delivered',
        description: `Lift #${updated.liftRef} — ${liftedQty.toFixed(3)} MT actual · ${salesInvoiceNo} (${existing.poRef} → ${existing.soRef})`,
        timestamp: new Date().toISOString(),
        user: CURRENT_TRADER,
        entityRef: `Lift-${updated.liftRef}`,
      }, ...prev.activities],
    }))

    return updated
  }, [data.lifts, data.tradeOrders])

  const canDeleteOrder = useCallback((id: string) => {
    const order = data.tradeOrders.find(o => o.id === id)
    if (!order) return { ok: false, reason: 'Order not found' }
    const reason = getDeleteBlockReason(order, data.tradeOrders, data.lifts)
    return reason ? { ok: false, reason } : { ok: true }
  }, [data.tradeOrders, data.lifts])

  const scheduleOrderDeletion = useCallback((id: string) => {
    const order = data.tradeOrders.find(o => o.id === id)
    if (!order) throw new Error('Order not found')
    const reason = getDeleteBlockReason(order, data.tradeOrders, data.lifts)
    if (reason) throw new Error(reason)

    const deleteScheduledAt = deletionDateFromNow()
    setData(prev => ({
      ...prev,
      tradeOrders: prev.tradeOrders.map(o => o.id === id ? { ...o, deleteScheduledAt } : o),
      activities: [{
        id: uid(),
        type: 'order_deletion_scheduled',
        title: order.side === 'purchase' ? 'PO deletion scheduled' : 'SO deletion scheduled',
        description: `${order.ref} will be deleted on ${formatDeletionDate(deleteScheduledAt)}`,
        timestamp: new Date().toISOString(),
        user: CURRENT_TRADER,
        entityRef: order.ref,
      }, ...prev.activities],
    }))
  }, [data.tradeOrders, data.lifts])

  const cancelOrderDeletion = useCallback((id: string) => {
    const order = data.tradeOrders.find(o => o.id === id)
    if (!order) throw new Error('Order not found')
    if (!order.deleteScheduledAt) throw new Error('No deletion scheduled for this order')

    setData(prev => ({
      ...prev,
      tradeOrders: prev.tradeOrders.map(o => o.id === id ? { ...o, deleteScheduledAt: undefined } : o),
      activities: [{
        id: uid(),
        type: 'order_updated',
        title: order.side === 'purchase' ? 'PO deletion cancelled' : 'SO deletion cancelled',
        description: `${order.ref} will no longer be deleted`,
        timestamp: new Date().toISOString(),
        user: CURRENT_TRADER,
        entityRef: order.ref,
      }, ...prev.activities],
    }))
  }, [data.tradeOrders])

  const getOrderByRef = useCallback((ref: string, side: OrderSide) =>
    data.tradeOrders.find(o => o.ref === ref && o.side === side),
  [data.tradeOrders])

  const addBroker = useCallback((input: AddBrokerInput) => {
    const name = input.name.trim()
    if (!name) throw new Error('Name is required')
    if (data.brokers.some(b => b.name.toLowerCase() === name.toLowerCase())) {
      throw new Error('A broker with this name already exists')
    }
    const broker: Broker = {
      id: uid(),
      name,
      email: input.email?.trim() ?? '',
      phone: input.phone?.trim() ?? '',
      contracts: 0,
      commissionEarned: 0,
      successRate: 0,
      network: 0,
    }
    setData(prev => ({ ...prev, brokers: [...prev.brokers, broker] }))
    return broker
  }, [data.brokers])

  const addProducer = useCallback((input: AddProducerInput) => {
    const name = input.name.trim()
    if (!name) throw new Error('Name is required')
    if (data.producers.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      throw new Error('A producer with this name already exists')
    }
    const products = parseProducts(input.products)
    const producer: Producer = {
      id: uid(),
      name,
      location: input.location?.trim() ?? '',
      products,
      contracts: 0,
      avgRate: 0,
      rating: 0,
    }
    setData(prev => ({
      ...prev,
      producers: [...prev.producers, producer],
      companies: upsertDirectoryCompany(prev.companies, producerToCompany(producer)),
    }))
    return producer
  }, [data.producers])

  const addRetailer = useCallback((input: AddRetailerInput) => {
    const name = input.name.trim()
    if (!name) throw new Error('Name is required')
    if (data.retailers.some(r => r.name.toLowerCase() === name.toLowerCase())) {
      throw new Error('A retailer with this name already exists')
    }
    const products = parseProducts(input.products)
    const retailer: Retailer = {
      id: uid(),
      name,
      location: input.location?.trim() ?? '',
      products,
      totalPurchases: 0,
      outstanding: 0,
      lastOrder: '',
    }
    setData(prev => ({
      ...prev,
      retailers: [...prev.retailers, retailer],
      companies: upsertDirectoryCompany(prev.companies, retailerToCompany(retailer)),
    }))
    return retailer
  }, [data.retailers])

  const addItem = useCallback((name: string) => {
    const trimmed = name.trim()
    if (!trimmed) throw new Error('Item name is required')
    if (data.items.some(i => i.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error('This item already exists')
    }
    setData(prev => ({ ...prev, items: upsertString(prev.items, trimmed) }))
    return trimmed
  }, [data.items])

  const updateBroker = useCallback((id: string, input: AddBrokerInput) => {
    const broker = data.brokers.find(b => b.id === id)
    if (!broker) throw new Error('Broker not found')
    const name = input.name.trim()
    if (!name) throw new Error('Name is required')
    if (data.brokers.some(b => b.id !== id && b.name.toLowerCase() === name.toLowerCase())) {
      throw new Error('A broker with this name already exists')
    }
    const oldName = broker.name
    setData(prev => ({
      ...prev,
      brokers: prev.brokers.map(b => b.id === id
        ? { ...b, name, email: input.email?.trim() ?? '', phone: input.phone?.trim() ?? '' }
        : b),
      tradeOrders: oldName !== name
        ? prev.tradeOrders.map(o => o.brokerName === oldName ? { ...o, brokerName: name } : o)
        : prev.tradeOrders,
      lots: oldName !== name
        ? prev.lots.map(l => l.broker === oldName ? { ...l, broker: name } : l)
        : prev.lots,
    }))
    return { ...broker, name, email: input.email?.trim() ?? '', phone: input.phone?.trim() ?? '' }
  }, [data.brokers])

  const canDeleteBroker = useCallback((id: string) => {
    const broker = data.brokers.find(b => b.id === id)
    if (!broker) return { ok: false, reason: 'Broker not found' }
    if (data.tradeOrders.some(o => o.brokerName === broker.name)) {
      return { ok: false, reason: 'Linked to one or more orders' }
    }
    return { ok: true }
  }, [data.brokers, data.tradeOrders])

  const deleteBroker = useCallback((id: string) => {
    const check = canDeleteBroker(id)
    if (!check.ok) throw new Error(check.reason ?? 'Cannot delete broker')
    setData(prev => ({ ...prev, brokers: prev.brokers.filter(b => b.id !== id) }))
  }, [canDeleteBroker])

  const updateProducer = useCallback((id: string, input: AddProducerInput) => {
    const producer = data.producers.find(p => p.id === id)
    if (!producer) throw new Error('Producer not found')
    const name = input.name.trim()
    if (!name) throw new Error('Name is required')
    if (data.producers.some(p => p.id !== id && p.name.toLowerCase() === name.toLowerCase())) {
      throw new Error('A producer with this name already exists')
    }
    const products = parseProducts(input.products)
    const oldName = producer.name
    setData(prev => ({
      ...prev,
      producers: prev.producers.map(p => p.id === id
        ? { ...p, name, location: input.location?.trim() ?? '', products }
        : p),
      companies: upsertDirectoryCompany(prev.companies, {
        ...producerToCompany({ ...producer, name, location: input.location?.trim() ?? '', products }),
      }),
      tradeOrders: oldName !== name
        ? prev.tradeOrders.map(o => o.side === 'purchase' && o.partyName === oldName
          ? { ...o, partyName: name }
          : o)
        : prev.tradeOrders,
      lots: oldName !== name
        ? prev.lots.map(l => l.producer === oldName ? { ...l, producer: name } : l)
        : prev.lots,
    }))
    return { ...producer, name, location: input.location?.trim() ?? '', products }
  }, [data.producers])

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

  const deleteProducer = useCallback((id: string) => {
    const check = canDeleteProducer(id)
    if (!check.ok) throw new Error(check.reason ?? 'Cannot delete producer')
    setData(prev => ({
      ...prev,
      producers: prev.producers.filter(p => p.id !== id),
      companies: removeDirectoryCompany(prev.companies, id, 'seller'),
    }))
  }, [canDeleteProducer])

  const updateRetailer = useCallback((id: string, input: AddRetailerInput) => {
    const retailer = data.retailers.find(r => r.id === id)
    if (!retailer) throw new Error('Retailer not found')
    const name = input.name.trim()
    if (!name) throw new Error('Name is required')
    if (data.retailers.some(r => r.id !== id && r.name.toLowerCase() === name.toLowerCase())) {
      throw new Error('A retailer with this name already exists')
    }
    const products = parseProducts(input.products)
    const oldName = retailer.name
    setData(prev => ({
      ...prev,
      retailers: prev.retailers.map(r => r.id === id
        ? { ...r, name, location: input.location?.trim() ?? '', products }
        : r),
      companies: upsertDirectoryCompany(prev.companies, {
        ...retailerToCompany({ ...retailer, name, location: input.location?.trim() ?? '', products }),
      }),
      tradeOrders: oldName !== name
        ? prev.tradeOrders.map(o => o.side === 'sale' && o.partyName === oldName
          ? { ...o, partyName: name }
          : o)
        : prev.tradeOrders,
    }))
    return { ...retailer, name, location: input.location?.trim() ?? '', products }
  }, [data.retailers])

  const canDeleteRetailer = useCallback((id: string) => {
    const retailer = data.retailers.find(r => r.id === id)
    if (!retailer) return { ok: false, reason: 'Retailer not found' }
    if (data.tradeOrders.some(o => o.side === 'sale' && o.partyName === retailer.name)) {
      return { ok: false, reason: 'Linked to one or more sales orders' }
    }
    return { ok: true }
  }, [data.retailers, data.tradeOrders])

  const deleteRetailer = useCallback((id: string) => {
    const check = canDeleteRetailer(id)
    if (!check.ok) throw new Error(check.reason ?? 'Cannot delete retailer')
    setData(prev => ({
      ...prev,
      retailers: prev.retailers.filter(r => r.id !== id),
      companies: removeDirectoryCompany(prev.companies, id, 'buyer'),
    }))
  }, [canDeleteRetailer])

  const getPOPending = useCallback(() =>
    data.tradeOrders.filter(o => o.side === 'purchase' && o.status !== 'completed' && o.status !== 'cancelled'),
    [data.tradeOrders])

  const getSOPending = useCallback(() =>
    data.tradeOrders.filter(o => o.side === 'sale' && o.status !== 'completed' && o.status !== 'cancelled'),
    [data.tradeOrders])

  const getPOCompleted = useCallback(() =>
    data.tradeOrders.filter(o => o.side === 'purchase' && o.status === 'completed'),
    [data.tradeOrders])

  const getSOCompleted = useCallback(() =>
    data.tradeOrders.filter(o => o.side === 'sale' && o.status === 'completed'),
    [data.tradeOrders])

  const getLiftsPending = useCallback(() =>
    data.lifts.filter(l => l.status === 'pending'),
    [data.lifts])

  const getLiftsDelivered = useCallback(() =>
    data.lifts.filter(l => l.status === 'delivered'),
    [data.lifts])

  const getPORegister = useCallback(() =>
    data.tradeOrders.filter(o => o.side === 'purchase'),
    [data.tradeOrders])

  const getSORegister = useCallback(() =>
    data.tradeOrders.filter(o => o.side === 'sale'),
    [data.tradeOrders])

  const getLastOrder = useCallback((side: OrderSide) =>
    data.tradeOrders.filter(o => o.side === side).sort((a, b) => b.date.localeCompare(a.date))[0],
    [data.tradeOrders])

  const getPOsAvailableForSO = useCallback(() =>
    data.tradeOrders.filter(o =>
      o.side === 'purchase'
      && o.status !== 'cancelled'
      && getRemainingSellQty(data.tradeOrders, o.ref) > 0
    ),
    [data.tradeOrders])

  const getRemainingSellQtyForPO = useCallback(
    (poRef: string) => getRemainingSellQty(data.tradeOrders, poRef),
    [data.tradeOrders],
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
    addOrder,
    updateOrder,
    addLift,
    updateLift,
    markLiftDelivered,
    scheduleOrderDeletion,
    cancelOrderDeletion,
    canDeleteOrder,
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
    getNextRef,
    getPOPending,
    getSOPending,
    getPOCompleted,
    getSOCompleted,
    getLiftsPending,
    getLiftsDelivered,
    getPORegister,
    getSORegister,
    getLastOrder,
    getPOsAvailableForSO,
    getRemainingSellQty: getRemainingSellQtyForPO,
    getSOsForPO: getSOsForPORef,
    revenueData,
    pipelineData,
  }

  return <TradeContext.Provider value={value}>{children}</TradeContext.Provider>
}

export function useTradeStore() {
  const ctx = useContext(TradeContext)
  if (!ctx) throw new Error('useTradeStore must be used within TradeProvider')
  return ctx
}

export function resetTradeData() {
  saveData(defaultData)
}

export function loadDemoData() {
  const seed = buildSeedData()
  saveData({
    ...defaultData,
    ...seed,
  })
}
