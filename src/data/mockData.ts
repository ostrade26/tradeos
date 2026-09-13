import { formatDeliveryPeriodRange, roundQtyMt } from '../lib/utils'

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

export interface Company {
  id: string
  officialName: string
  aliases: string[]
  types: CompanyType[]
  gst?: string
  location?: string
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
  unloading?: string
  /** PO-only — total freight in ₹ */
  freightCost?: number
  /** PO-only — total loading in ₹ */
  loadingCost?: number
  /** PO-only — other landed costs in ₹ */
  otherCost?: number
  remarks?: string
  status: OrderStatus
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
  isSelfLift: boolean
  /** Receive stock to own inventory — no sales order required. */
  stockLift?: boolean
  /** Buyer accepts loading without tanker cleaning at producer — shared on WhatsApp. */
  loadOnRisk?: boolean
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

export interface Producer {
  id: string
  name: string
  location: string
  products: string[]
  contracts: number
  avgRate: number
  rating: number
}

export interface Retailer {
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
export const spots: string[] = []
export const items: string[] = []

/** @deprecated Use useTradeStore() — kept for type-only imports */

export function toBeLifted(order: Pick<TradeOrder, 'orderQty' | 'committedLiftQty' | 'liftedQty'>): number {
  const committed = order.committedLiftQty ?? order.liftedQty
  return Math.max(0, order.orderQty - committed)
}

/** Qty not yet physically lifted (delivered) — matches PO/SO Qty minus Lifted Qty. */
export function unliftedQty(order: Pick<TradeOrder, 'orderQty' | 'liftedQty'>): number {
  return roundQtyMt(Math.max(0, order.orderQty - order.liftedQty))
}

export function getLiftsPending(lifts: Lift[]): Lift[] {
  return lifts.filter(l => l.status === 'pending')
}

export function getLiftsDelivered(lifts: Lift[]): Lift[] {
  return lifts.filter(l => l.status === 'delivered')
}

export function formatDeliveryPeriodLabel(order: Pick<TradeOrder, 'deliveryType'>): string {
  return order.deliveryType === 'ready' ? 'Ready' : 'Period'
}

export function formatDeliveryPeriod(order: Pick<TradeOrder, 'deliveryType' | 'deliveryPeriodStart' | 'deliveryPeriodEnd'>): string {
  if (order.deliveryType === 'ready') return 'Ready'
  return formatDeliveryPeriodRange(order.deliveryPeriodStart, order.deliveryPeriodEnd)
}

export function getPOPending(orders: TradeOrder[]): TradeOrder[] {
  return orders.filter(o => o.side === 'purchase' && o.status !== 'completed' && o.status !== 'cancelled')
}

export function getSOPending(orders: TradeOrder[]): TradeOrder[] {
  return orders.filter(o => o.side === 'sale' && o.status !== 'completed' && o.status !== 'cancelled')
}

export function getPOCompleted(orders: TradeOrder[]): TradeOrder[] {
  return orders.filter(o => o.side === 'purchase' && o.status === 'completed')
}

export function getSOCompleted(orders: TradeOrder[]): TradeOrder[] {
  return orders.filter(o => o.side === 'sale' && o.status === 'completed')
}

export function getPORegister(orders: TradeOrder[]): TradeOrder[] {
  return orders.filter(o => o.side === 'purchase')
}

export function getSORegister(orders: TradeOrder[]): TradeOrder[] {
  return orders.filter(o => o.side === 'sale')
}

export function getLastOrder(orders: TradeOrder[], side: OrderSide): TradeOrder | undefined {
  return orders.filter(o => o.side === side).sort((a, b) => b.date.localeCompare(a.date))[0]
}

/** Qty on a PO still available to allocate to new SOs */
export function getRemainingSellQty(orders: TradeOrder[], poRef: string): number {
  const po = orders.find(o => o.ref === poRef && o.side === 'purchase')
  if (!po) return 0
  const soldQty = orders
    .filter(o => o.side === 'sale' && o.poRef === poRef && o.status !== 'cancelled')
    .reduce((sum, o) => sum + o.orderQty, 0)
  return roundQtyMt(po.orderQty - soldQty)
}

export function getSOsForPO(orders: TradeOrder[], poRef: string): TradeOrder[] {
  return orders.filter(o => o.side === 'sale' && o.poRef === poRef)
}
