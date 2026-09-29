import { formatDeliveryPeriodRange, roundQtyMt } from '../lib/utils'
import { refsMatch } from '../lib/tradeRefs'

export type OrderSide = 'purchase' | 'sale'
export type OrderStatus = 'pending' | 'partial' | 'completed' | 'cancelled'
export type OrderCompletionType = 'delivered' | 'cash_settled' | 'carried_forward' | 'short_closed'
export type BalanceSettlementMethod = 'cash' | 'carried_forward'
export type DeliveryType = 'period' | 'ready'
export type ContractStatus = 'draft' | 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled'
export type PaymentStatus = 'outstanding' | 'advance' | 'partial' | 'completed'
export type DeliveryStatus = 'upcoming' | 'in_transit' | 'delivered' | 'delayed'

export const CURRENT_TRADER = 'Shri Kubera Traders'
export const CURRENT_TRADER_LOCATION = 'Kolhapur'

export type CompanyType = 'seller' | 'buyer' | 'both'

/** Shared optional directory fields for producers / retailers (parties). */
export interface PartyDetails {
  code?: string
  address?: string
  city?: string
  contactPerson?: string
  phone?: string
  whatsapp?: string
  email?: string
  tan?: string
  /** @deprecated Prefer `tan` — kept for older saved trade_state. */
  tin?: string
  fssai?: string
  bankName?: string
  bankAccount?: string
  ifsc?: string
  pan?: string
  aadhar?: string
  gst?: string
}

export interface Company {
  id: string
  officialName: string
  aliases: string[]
  types: CompanyType[]
  gst?: string
  location?: string
  code?: string
}

export interface TradeOrder {
  id: string
  ref: string
  side: OrderSide
  poRef?: string
  brokerContractRef?: string
  date: string
  /** Resolved official party name (seller on PO, buyer on SO) */
  partyName: string
  /** Internal company ID for primary party */
  partyCompanyId?: string
  sellerCompanyId?: string
  buyerCompanyId?: string
  /** Original PDF extraction — audit only */
  extractedPartyName?: string
  extractedSellerName?: string
  extractedBuyerName?: string
  itemName: string
  spot: string
  deliveryType: DeliveryType
  deliveryPeriodStart: string
  deliveryPeriodEnd: string
  deliveryPeriodVerified: boolean
  rate: number
  taxRate: number
  orderQty: number
  /** Delivered lift qty (actual at destination). */
  liftedQty: number
  /** All scheduled lift qty (pending + delivered). */
  committedLiftQty: number
  unit: string
  brokerName: string
  brokeragePct: number
  brokeragePerTon?: number
  sellerName?: string
  buyerName?: string
  partyConfirmedBy?: string
  sellerConfirmedBy?: string
  buyerConfirmedBy?: string
  sellerGst?: string
  buyerGst?: string
  contractRateDisplay?: string
  brand?: string
  rateBasis?: string
  ratePerBasis?: number
  paymentTerms?: string
  remarks?: string
  status: OrderStatus
  /**
   * Lot this SO sells from after the purchase was closed.
   * Not a contract link — the closed PO's avail / allocation stay unchanged.
   */
  stockPoRef?: string
  /** How the order was closed when liftedQty < orderQty. */
  completionType?: OrderCompletionType
  /** ISO timestamp when manually closed. */
  closedAt?: string
  closedNotes?: string
  /** ISO timestamp — order is removed after this date (7-day grace). */
  deleteScheduledAt?: string
  /** Seller repurchased undelivered qty before lift. */
  buyBacks?: BuyBack[]
}

export interface BalanceSettlement {
  id: string
  poRef: string
  soRef: string
  qtyMt: number
  rate: number
  amount: number
  method: BalanceSettlementMethod
  settledAt: string
  notes?: string
  /** Remaining unlifted qty closed onto the seller ledger for the next lift. */
  source?: 'unlifted'
}

export interface BuyBack {
  id: string
  date: string
  qtyMt: number
  rate: number
  rateBasis?: string
  ratePerBasis?: number
  remarks?: string
}

export interface LiftTanker {
  tankerNo: string
  transportName: string
  driverMobile: string
  lrNo: string
  /** Actual weighed quantity loaded on this tanker (MT). */
  actualQtyMt?: number
  /** Sales invoice for this tanker (multi-tanker deliveries). */
  salesInvoiceNo?: string
  /** Purchase / seller invoice for this tanker (captured on delivery). */
  poInvoiceNo?: string
}

export type LiftStatus = 'pending' | 'delivered'

/** One SO (and the PO it draws from) on a tanker lift. Stock lifts omit soRef. */
export interface LiftAllocation {
  poRef: string
  soRef?: string
  qtyMt: number
}

export interface Lift {
  id: string
  liftRef: number
  /** Primary PO — first allocation. Kept for search and older records. */
  poRef: string
  /** Primary SO — first allocation. Kept for search and older records. */
  soRef: string
  /** Orders on this tanker. Missing on older records — use getLiftAllocations(). */
  allocations?: LiftAllocation[]
  date: string
  status: LiftStatus
  /** Set when status becomes delivered. */
  deliveredAt?: string
  buyerName: string
  sellerName: string
  itemName: string
  deliveryPeriod: string
  deliveryPeriodStart: string
  deliveryPeriodEnd: string
  deliveryPeriodVerified: boolean
  rate: number
  liftedQty: number
  /** Planned dispatch qty (MT) — set at lift creation, kept after delivery. */
  plannedQtyMt?: number
  /** Shortfall when actual is below planned on delivery — seller owes this for this DO. */
  balanceQtyMt?: number
  /** Prior shortfall included in this lift's planned qty. */
  balanceAppliedQtyMt?: number
  /** Primary tanker number (first in `tankers`) — kept for search and legacy display. */
  tankerNo: string
  tankers: LiftTanker[]
  salesInvoiceNo?: string
  /** Purchase / seller invoice(s) captured when marking delivered. */
  poInvoiceNo?: string
  isSelfLift: boolean
  /** Receive stock to own inventory — no sales order required. */
  stockLift?: boolean
  /** Buyer accepts loading without tanker cleaning at producer — shared on WhatsApp. */
  loadOnRisk?: boolean
  /** Soft-deleted — shown on Deleted tab until permanently removed. */
  deletedAt?: string
  remarks?: string
}

export interface Contract {
  id: string
  ref: string
  status: ContractStatus
  buyer: string
  seller: string
  commodity: string
  quantity: number
  unit: string
  rate: number
  value: number
  broker: string
  deliveryDate: string
  paymentStatus: PaymentStatus
  createdAt: string
  location: string
}

export interface Lot {
  id: string
  lotNumber: string
  commodity: string
  purchasePrice: number
  quantityPurchased: number
  remaining: number
  allocated: number
  available: number
  unit: string
  producer: string
  broker: string
  purchaseDate: string
  expiry?: string
  contractId: string
  margin: number
}

export interface Payment {
  id: string
  contractRef: string
  party: string
  type: 'advance' | 'partial' | 'final'
  amount: number
  status: PaymentStatus
  dueDate: string
  paidDate?: string
  method?: string
}

export interface Delivery {
  id: string
  contractRef: string
  commodity: string
  quantity: number
  unit: string
  status: DeliveryStatus
  scheduledDate: string
  deliveredDate?: string
  from: string
  to: string
  truckNumber?: string
  driverName?: string
  driverPhone?: string
}

export interface BrokerageTerms {
  mode: 'percent' | 'perTon'
  value: number
}

export interface BrokerItemBrokerage {
  itemName: string
  purchase?: BrokerageTerms
  sale?: BrokerageTerms
}

export interface Broker {
  id: string
  name: string
  email: string
  phone: string
  contracts: number
  commissionEarned: number
  successRate: number
  network: number
  /** Default brokerage on purchase orders */
  purchaseBrokerage?: BrokerageTerms
  /** Default brokerage on sales orders */
  saleBrokerage?: BrokerageTerms
  /** Item-specific overrides — used before defaults */
  itemBrokerages?: BrokerItemBrokerage[]
}

export interface Producer extends PartyDetails {
  id: string
  name: string
  location: string
  products: string[]
  contracts: number
  avgRate: number
  rating: number
}

export interface Retailer extends PartyDetails {
  id: string
  name: string
  location: string
  totalPurchases: number
  outstanding: number
  products: string[]
  lastOrder: string
}

export interface Activity {
  id: string
  type: 'contract_created' | 'payment_received' | 'goods_dispatched' | 'stock_allocated' | 'inventory_sold' | 'delivery_completed' | 'lift_recorded' | 'po_created' | 'so_created' | 'order_deleted' | 'order_updated' | 'order_deletion_scheduled' | 'po_buy_back' | 'balance_cash_settled' | 'order_closed_carried' | 'order_short_closed'
  title: string
  description: string
  timestamp: string
  user: string
  entityRef?: string
}

export const tradeOrders: TradeOrder[] = []
export const lifts: Lift[] = []
export const contracts: Contract[] = []
export const lots: Lot[] = []
export const payments: Payment[] = []
export const deliveries: Delivery[] = []
export const brokers: Broker[] = []
export const producers: Producer[] = []
export const retailers: Retailer[] = []
export const companies: Company[] = []
export const activities: Activity[] = []
export const revenueData: { month: string; purchase: number; sales: number }[] = []
export const priceTrends: { date: string; palmOil: number; soybean: number; coconut: number }[] = []
export const pipelineData: { stage: string; count: number; value: number }[] = []
export interface CatalogItem {
  id: string
  name: string
  hsn?: string
  gstRate?: number | null
  grade?: string
  packing?: string
  notes?: string
}

export const spots: string[] = []
export const items: string[] = []

/** @deprecated Use useTradeStore() — kept for type-only imports */

function orderQtyCap(order: Pick<TradeOrder, 'orderQty' | 'liftedQty' | 'buyBacks' | 'side'>): number {
  if (order.side === 'purchase') {
    const boughtBack = (order.buyBacks ?? []).reduce((sum, b) => sum + b.qtyMt, 0)
    return Math.max(0, order.orderQty - boughtBack)
  }
  return order.orderQty
}

export function toBeLifted(
  order: Pick<TradeOrder, 'orderQty' | 'committedLiftQty' | 'liftedQty' | 'buyBacks' | 'side'>,
): number {
  const committed = order.committedLiftQty ?? order.liftedQty
  return Math.max(0, orderQtyCap(order) - committed)
}

/** Qty not yet physically lifted (delivered) — active qty minus lifted. */
export function unliftedQty(
  order: Pick<TradeOrder, 'orderQty' | 'liftedQty' | 'buyBacks' | 'side'>,
): number {
  return roundQtyMt(Math.max(0, orderQtyCap(order) - order.liftedQty))
}

export function getLiftsPending(lifts: Lift[]): Lift[] {
  return lifts.filter(l => l.status === 'pending' && !l.deletedAt)
}

export function getLiftsDelivered(lifts: Lift[]): Lift[] {
  return lifts.filter(l => l.status === 'delivered' && !l.deletedAt)
}

export function getLiftsDeleted(lifts: Lift[]): Lift[] {
  return lifts.filter(l => Boolean(l.deletedAt))
}

export function formatDeliveryPeriodLabel(order: Pick<TradeOrder, 'deliveryType' | 'deliveryPeriodStart' | 'deliveryPeriodEnd'>): string {
  return formatDeliveryPeriod(order)
}

export function formatDeliveryPeriod(order: Pick<TradeOrder, 'deliveryType' | 'deliveryPeriodStart' | 'deliveryPeriodEnd'>): string {
  if (order.deliveryType === 'ready') return 'Ready'
  return formatDeliveryPeriodRange(order.deliveryPeriodStart, order.deliveryPeriodEnd)
}

export function isLotSale(order: Pick<TradeOrder, 'side' | 'poRef' | 'stockPoRef'>): boolean {
  return order.side === 'sale' && Boolean(order.stockPoRef) && !order.poRef
}

export function getPOPending(orders: TradeOrder[]): TradeOrder[] {
  return orders.filter(o => o.side === 'purchase' && o.status !== 'completed' && o.status !== 'cancelled' && !o.deleteScheduledAt)
}

export function getSOPending(orders: TradeOrder[]): TradeOrder[] {
  return orders.filter(o => o.side === 'sale' && !isLotSale(o) && o.status !== 'completed' && o.status !== 'cancelled' && !o.deleteScheduledAt)
}

export function getPOCompleted(orders: TradeOrder[]): TradeOrder[] {
  return orders.filter(o => o.side === 'purchase' && o.status === 'completed' && !o.deleteScheduledAt)
}

export function getSOCompleted(orders: TradeOrder[]): TradeOrder[] {
  return orders.filter(o => o.side === 'sale' && !isLotSale(o) && o.status === 'completed' && !o.deleteScheduledAt)
}

export function getPODeleted(orders: TradeOrder[]): TradeOrder[] {
  return orders.filter(o => o.side === 'purchase' && Boolean(o.deleteScheduledAt))
}

export function getSODeleted(orders: TradeOrder[]): TradeOrder[] {
  return orders.filter(o => o.side === 'sale' && !isLotSale(o) && Boolean(o.deleteScheduledAt))
}

export function getPORegister(orders: TradeOrder[]): TradeOrder[] {
  return orders.filter(o => o.side === 'purchase' && !o.deleteScheduledAt)
}

export function getSORegister(orders: TradeOrder[]): TradeOrder[] {
  return orders.filter(o => o.side === 'sale' && !o.deleteScheduledAt)
}

export function getLastOrder(orders: TradeOrder[], side: OrderSide): TradeOrder | undefined {
  return orders.filter(o => o.side === side).sort((a, b) => b.date.localeCompare(a.date))[0]
}

/** Linked SO qty allocated against a PO (excludes cancelled / delete-scheduled). */
function unlinkedLiftQtyOnPo(lifts: Lift[], poRef: string, soRef: string): number {
  let total = 0
  for (const lift of lifts) {
    if (lift.deletedAt) continue
    const allocations = lift.allocations?.length
      ? lift.allocations
      : [{ poRef: lift.poRef, soRef: lift.soRef, qtyMt: lift.liftedQty }]
    for (const a of allocations) {
      if (
        a.soRef
        && refsMatch(a.soRef, soRef, 'sale')
        && refsMatch(a.poRef, poRef, 'purchase')
      ) {
        total += a.qtyMt
      }
    }
  }
  return total
}

export function getAllocatedSellQty(orders: TradeOrder[], poRef: string, lifts: Lift[] = []): number {
  return roundQtyMt(
    getSOsForPO(orders, poRef, lifts)
      .filter(o => o.status !== 'cancelled' && !o.deleteScheduledAt)
      .reduce((sum, o) => sum + (
        refsMatch(o.poRef, poRef, 'purchase') ? o.orderQty : unlinkedLiftQtyOnPo(lifts, poRef, o.ref)
      ), 0),
  )
}

/** Qty reserved by own-stock lifts against a PO (pending + delivered). */
export function getStockLiftQtyOnPo(lifts: Lift[], poRef: string): number {
  return roundQtyMt(
    lifts
      .filter(l => !l.deletedAt)
      .flatMap(l => {
        const allocations = l.allocations?.length
          ? l.allocations
          : [{ poRef: l.poRef, soRef: l.soRef, qtyMt: l.liftedQty }]
        return allocations
      })
      .filter(a => refsMatch(a.poRef, poRef, 'purchase') && !a.soRef)
      .reduce((sum, a) => sum + a.qtyMt, 0),
  )
}

/**
 * Qty on a PO still available to allocate to new SOs.
 * Own-stock lifts consume the same PO cap as booked SOs.
 */
const MANUAL_CLOSE = new Set<TradeOrder['completionType']>(['cash_settled', 'carried_forward', 'short_closed', 'delivered'])

export function getRemainingSellQty(orders: TradeOrder[], poRef: string, lifts: Lift[] = []): number {
  const po = orders.find(o => o.side === 'purchase' && refsMatch(o.ref, poRef, 'purchase'))
  if (!po || po.status === 'cancelled' || (po.completionType && MANUAL_CLOSE.has(po.completionType))) return 0
  const cap = orderQtyCap(po)
  const booked = getAllocatedSellQty(orders, poRef, lifts) + getStockLiftQtyOnPo(lifts, poRef)
  const moved = lifts
    .filter(l => !l.deletedAt)
    .flatMap(l => {
      const allocations = l.allocations?.length
        ? l.allocations
        : [{ poRef: l.poRef, soRef: l.soRef, qtyMt: l.liftedQty }]
      return allocations
    })
    .filter(a => {
      if (!refsMatch(a.poRef, poRef, 'purchase')) return false
      if (!a.soRef) return true
      const sale = orders.find(o => o.side === 'sale' && refsMatch(o.ref, a.soRef, 'sale'))
      return !(sale?.stockPoRef && !sale.poRef && refsMatch(sale.stockPoRef, poRef, 'purchase'))
    })
    .reduce((sum, a) => sum + a.qtyMt, 0)
  return roundQtyMt(cap - Math.max(booked, moved))
}

/** Sales made from this godown lot. Contract SOs booked on the PO stay on the purchase. */
export function getOrdersDrawingLot(
  orders: TradeOrder[],
  poRef: string,
  lifts: Lift[] = [],
  options?: { includeDeleted?: boolean },
): TradeOrder[] {
  void lifts
  return orders.filter(
    o =>
      o.side === 'sale'
      && o.status !== 'cancelled'
      && (options?.includeDeleted || !o.deleteScheduledAt)
      && Boolean(o.stockPoRef)
      && !o.poRef
      && refsMatch(o.stockPoRef, poRef, 'purchase'),
  )
}

export function getSOsForPO(orders: TradeOrder[], poRef: string, lifts: Lift[] = []): TradeOrder[] {
  return orders.filter(o => {
    if (o.side !== 'sale' || o.status === 'cancelled') return false
    if (o.stockPoRef && !o.poRef) return false
    if (refsMatch(o.poRef, poRef, 'purchase')) return true
    return lifts.some(l => {
      if (l.deletedAt) return false
      const allocations = l.allocations?.length
        ? l.allocations
        : [{ poRef: l.poRef, soRef: l.soRef, qtyMt: l.liftedQty }]
      return allocations.some(a =>
        Boolean(a.soRef)
        && refsMatch(a.soRef, o.ref, 'sale')
        && refsMatch(a.poRef, poRef, 'purchase'),
      )
    })
  })
}
