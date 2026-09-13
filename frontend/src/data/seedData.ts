import type {
  Activity,
  Broker,
  Company,
  Delivery,
  Lift,
  Lot,
  Payment,
  Producer,
  Retailer,
  TradeOrder,
} from './mockData'
import {
  CURRENT_TRADER,
  formatDeliveryPeriod,
} from './mockData'
import { formatQty } from '../lib/utils'
import { formatContractRate } from '../lib/orderRate'

export interface SeedTradeData {
  tradeOrders: TradeOrder[]
  lifts: Lift[]
  lots: Lot[]
  brokers: Broker[]
  producers: Producer[]
  retailers: Retailer[]
  companies: Company[]
  deliveries: Delivery[]
  activities: Activity[]
  payments: Payment[]
  spots: string[]
  items: string[]
  counters: { po: number; so: number; lift: number; invoice: number }
}

const SPOTS = ['Kolhapur', 'Mumbai', 'Surat', 'Navi Mumbai', 'Pune', 'Ahmedabad', 'Nagpur', 'Indore']
const ITEMS = ['Palm Oil', 'Soybean Oil', 'Coconut Oil', 'RBD Palmolein', 'Sunflower Oil', 'Rice Bran Oil']

const BROKER_SEED = [
  { name: "SHREE GURUKRUPA BROKER'S", email: 'gurukrupa@broker.in', phone: '+91 98220 44102' },
  { name: 'Amogh Paragi & Co.', email: 'amogh@apbroker.com', phone: '+91 94220 11880' },
  { name: 'Kolhapur Commodity Brokers', email: 'office@kcbrokers.in', phone: '+91 231 265 4421' },
  { name: 'Western India Oils Brokerage', email: 'trade@wibroker.com', phone: '+91 98901 22334' },
  { name: 'Maharashtra Agri Brokers', email: 'contact@mabrokers.in', phone: '+91 97654 33210' },
]

const PRODUCER_SEED = [
  { name: 'DVC Process Tech Pvt Ltd', location: 'Navi Mumbai', products: ['Palm Oil', 'RBD Palmolein'] },
  { name: 'Patanjali Foods Ltd', location: 'Haridwar', products: ['Soybean Oil', 'Sunflower Oil'] },
  { name: 'Adani Wilmar Ltd', location: 'Ahmedabad', products: ['Palm Oil', 'Soybean Oil'] },
  { name: 'Gemini Edibles & Fats', location: 'Kakinada', products: ['Palm Oil', 'Coconut Oil'] },
  { name: 'Liberty Oil Mills', location: 'Mumbai', products: ['RBD Palmolein', 'Rice Bran Oil'] },
  { name: 'Vijay Solvex Ltd', location: 'Indore', products: ['Soybean Oil'] },
  { name: 'K S Oils Ltd', location: 'Morena', products: ['Mustard Oil', 'Soybean Oil'] },
  { name: 'Ruchi Soya Industries', location: 'Gandhidham', products: ['Soybean Oil', 'Palm Oil'] },
]

const RETAILER_SEED = [
  { name: 'Haldiram Foods International', location: 'Nagpur', products: ['Palm Oil', 'Rice Bran Oil'] },
  { name: 'Britannia Industries Ltd', location: 'Bangalore', products: ['Palm Oil', 'Coconut Oil'] },
  { name: 'Parle Products Pvt Ltd', location: 'Mumbai', products: ['Palm Oil', 'Soybean Oil'] },
  { name: 'ITC Limited — Foods Division', location: 'Kolkata', products: ['Sunflower Oil', 'Soybean Oil'] },
  { name: 'Bikano Foods Pvt Ltd', location: 'Delhi', products: ['Palm Oil', 'RBD Palmolein'] },
  { name: 'Prataap Snacks Ltd', location: 'Indore', products: ['Palm Oil'] },
  { name: 'Balaji Wafers Pvt Ltd', location: 'Rajkot', products: ['Palm Oil', 'Coconut Oil'] },
  { name: 'MTR Foods Pvt Ltd', location: 'Bangalore', products: ['Coconut Oil', 'Rice Bran Oil'] },
]

function id(prefix: string, n: number) {
  return `seed-${prefix}-${n}`
}

function dateOffset(daysAgo: number) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

function orderStatus(order: Pick<TradeOrder, 'orderQty' | 'liftedQty'>): TradeOrder['status'] {
  if (order.liftedQty >= order.orderQty) return 'completed'
  if (order.liftedQty > 0) return 'partial'
  return 'pending'
}

function lotNumberForPO(poRef: string) {
  return `LOT-${poRef}`
}

export function buildSeedData(): SeedTradeData {
  const brokers: Broker[] = BROKER_SEED.map((b, i) => ({
    id: id('broker', i + 1),
    name: b.name,
    email: b.email,
    phone: b.phone,
    contracts: 0,
    commissionEarned: 0,
    successRate: 88 + (i % 4) * 3,
    network: 12 + i * 4,
    purchaseBrokerage: { mode: 'perTon', value: 70 + (i % 3) * 5 },
    saleBrokerage: { mode: 'perTon', value: 60 + (i % 3) * 5 },
    itemBrokerages: i === 0
      ? [{
        itemName: 'Palm Oil',
        purchase: { mode: 'perTon', value: 80 },
        sale: { mode: 'perTon', value: 70 },
      }]
      : i === 1
        ? [{
          itemName: 'Soybean Oil',
          purchase: { mode: 'perTon', value: 75 },
          sale: { mode: 'perTon', value: 65 },
        }]
        : undefined,
  }))

  const producers: Producer[] = PRODUCER_SEED.map((p, i) => ({
    id: id('producer', i + 1),
    name: p.name,
    location: p.location,
    products: p.products,
    contracts: 0,
    avgRate: 0,
    rating: 4 + (i % 2) * 0.5,
  }))

  const retailers: Retailer[] = RETAILER_SEED.map((r, i) => ({
    id: id('retailer', i + 1),
    name: r.name,
    location: r.location,
    products: r.products,
    totalPurchases: 0,
    outstanding: 0,
    lastOrder: '',
  }))

  const companies: Company[] = [
    ...producers.map((p, i) => ({
      id: p.id,
      officialName: p.name,
      aliases: i === 0 ? ['DVC', 'DCV'] : [] as string[],
      types: ['seller'] as Company['types'],
      location: p.location,
    })),
    ...retailers.map(r => ({
      id: r.id,
      officialName: r.name,
      aliases: [] as string[],
      types: ['buyer'] as Company['types'],
      location: r.location,
    })),
    {
      id: id('company', 99),
      officialName: CURRENT_TRADER,
      aliases: [],
      types: ['buyer', 'seller'],
      location: 'Kolhapur',
    },
  ]

  const tradeOrders: TradeOrder[] = []

  const poConfigs = [
    { qty: 100, item: 'Palm Oil', producer: 0, rateMt: 98500, lifted: 25, daysAgo: 145, spot: 0, broker: 0 },
    { qty: 80, item: 'Soybean Oil', producer: 1, rateMt: 92000, lifted: 80, daysAgo: 130, spot: 1, broker: 1 },
    { qty: 120, item: 'RBD Palmolein', producer: 0, rateMt: 148000, lifted: 40, daysAgo: 115, spot: 2, broker: 0 },
    { qty: 60, item: 'Coconut Oil', producer: 3, rateMt: 112000, lifted: 0, daysAgo: 100, spot: 3, broker: 2 },
    { qty: 90, item: 'Palm Oil', producer: 2, rateMt: 97800, lifted: 0, daysAgo: 90, spot: 4, broker: 3 },
    { qty: 75, item: 'Sunflower Oil', producer: 1, rateMt: 89500, lifted: 30, daysAgo: 75, spot: 5, broker: 1 },
    { qty: 110, item: 'Soybean Oil', producer: 4, rateMt: 93100, lifted: 0, daysAgo: 65, spot: 0, broker: 4 },
    { qty: 50, item: 'Rice Bran Oil', producer: 4, rateMt: 76500, lifted: 0, daysAgo: 55, spot: 6, broker: 2 },
    { qty: 95, item: 'Palm Oil', producer: 5, rateMt: 99000, lifted: 95, daysAgo: 48, spot: 1, broker: 0 },
    { qty: 85, item: 'RBD Palmolein', producer: 6, rateMt: 146000, lifted: 0, daysAgo: 42, spot: 2, broker: 3 },
    { qty: 70, item: 'Coconut Oil', producer: 3, rateMt: 114500, lifted: 15, daysAgo: 35, spot: 3, broker: 1 },
    { qty: 105, item: 'Palm Oil', producer: 2, rateMt: 98200, lifted: 0, daysAgo: 28, spot: 4, broker: 4 },
    { qty: 65, item: 'Soybean Oil', producer: 7, rateMt: 91800, lifted: 0, daysAgo: 21, spot: 5, broker: 2 },
    { qty: 88, item: 'Sunflower Oil', producer: 1, rateMt: 90200, lifted: 0, daysAgo: 18, spot: 0, broker: 0 },
    { qty: 55, item: 'Palm Oil', producer: 0, rateMt: 99100, lifted: 0, daysAgo: 14, spot: 1, broker: 3 },
    { qty: 92, item: 'RBD Palmolein', producer: 6, rateMt: 147500, lifted: 0, daysAgo: 10, spot: 2, broker: 1 },
    { qty: 78, item: 'Soybean Oil', producer: 4, rateMt: 92600, lifted: 0, daysAgo: 7, spot: 3, broker: 4 },
    { qty: 100, item: 'Palm Oil', producer: 2, rateMt: 98600, lifted: 0, daysAgo: 5, spot: 4, broker: 0 },
    { qty: 45, item: 'Coconut Oil', producer: 3, rateMt: 113800, lifted: 0, daysAgo: 3, spot: 5, broker: 2 },
    { qty: 68, item: 'Rice Bran Oil', producer: 4, rateMt: 77200, lifted: 0, daysAgo: 1, spot: 6, broker: 3 },
  ]

  for (let i = 0; i < poConfigs.length; i++) {
    const c = poConfigs[i]
    const n = i + 1
    const producer = producers[c.producer]
    const broker = brokers[c.broker]
    const orderDate = dateOffset(c.daysAgo)
    const endDate = dateOffset(Math.max(0, c.daysAgo - 20))
    tradeOrders.push({
      id: id('po', n),
      ref: `PO-${n}`,
      side: 'purchase',
      brokerContractRef: String(700 + n),
      date: orderDate,
      partyName: producer.name,
      partyCompanyId: producer.id,
      sellerCompanyId: producer.id,
      buyerCompanyId: id('company', 99),
      itemName: c.item,
      spot: SPOTS[c.spot % SPOTS.length],
      deliveryType: 'period',
      deliveryPeriodStart: orderDate,
      deliveryPeriodEnd: endDate,
      deliveryPeriodVerified: n % 3 !== 0,
      rate: c.rateMt,
      ratePerBasis: c.rateMt / 100,
      rateBasis: 'PER 10 KG',
      contractRateDisplay: `${(c.rateMt / 100).toLocaleString('en-IN')}.00 PER 10 KG`,
      taxRate: 5,
      orderQty: c.qty,
      liftedQty: c.lifted,
      committedLiftQty: c.lifted,
      unit: 'MT',
      brokerName: broker.name,
      brokeragePct: 0,
      brokeragePerTon: 75,
      sellerName: producer.name,
      buyerName: CURRENT_TRADER,
      paymentTerms: n % 2 === 0 ? 'Advance' : 'Against delivery',
      unloading: 'Buyer account',
      remarks: n % 4 === 0 ? 'Fixed duty' : '',
      status: orderStatus({ orderQty: c.qty, liftedQty: c.lifted }),
    })
    producer.contracts += 1
    producer.avgRate = c.rateMt
    broker.contracts += 1
    broker.commissionEarned += c.qty * 75
  }

  const po2 = tradeOrders.find(o => o.ref === 'PO-2')
  if (po2) {
    po2.freightCost = 4000
    po2.loadingCost = 1000
    po2.otherCost = 500
    po2.brokeragePerTon = 15
  }

  const soConfigs = [
    { po: 1, qty: 50, retailer: 0, premium: 1200, lifted: 25, daysAgo: 120 },
    { po: 2, qty: 80, retailer: 1, premium: 900, lifted: 80, daysAgo: 110 },
    { po: 3, qty: 60, retailer: 2, premium: 1100, lifted: 40, daysAgo: 95 },
    { po: 4, qty: 40, retailer: 3, premium: 1500, lifted: 0, daysAgo: 85 },
    { po: 5, qty: 55, retailer: 4, premium: 800, lifted: 0, daysAgo: 70 },
    { po: 6, qty: 45, retailer: 5, premium: 950, lifted: 30, daysAgo: 60 },
    { po: 9, qty: 95, retailer: 6, premium: 700, lifted: 95, daysAgo: 40 },
    { po: 11, qty: 50, retailer: 7, premium: 1300, lifted: 15, daysAgo: 30 },
    { po: null, qty: 35, retailer: 0, premium: 1000, lifted: 0, daysAgo: 20, item: 'Palm Oil', rateMt: 99800 },
    { po: 12, qty: 70, retailer: 1, premium: 850, lifted: 0, daysAgo: 12 },
  ]

  for (let i = 0; i < soConfigs.length; i++) {
    const c = soConfigs[i]
    const n = i + 1
    const retailer = retailers[c.retailer]
    const po = c.po ? tradeOrders.find(o => o.ref === `PO-${c.po}`) : undefined
    const rateMt = po ? po.rate + c.premium : (c.rateMt ?? 95000)
    const itemName = po?.itemName ?? c.item ?? 'Palm Oil'
    const orderDate = dateOffset(c.daysAgo)
    const endDate = dateOffset(Math.max(0, c.daysAgo - 15))
    const brokerName = po?.brokerName ?? brokers[i % brokers.length].name

    tradeOrders.push({
      id: id('so', n),
      ref: `SO-${n}`,
      side: 'sale',
      poRef: po?.ref,
      brokerContractRef: String(800 + n),
      date: orderDate,
      partyName: retailer.name,
      partyCompanyId: retailer.id,
      buyerCompanyId: retailer.id,
      sellerCompanyId: id('company', 99),
      itemName,
      spot: po?.spot ?? SPOTS[n % SPOTS.length],
      deliveryType: 'period',
      deliveryPeriodStart: orderDate,
      deliveryPeriodEnd: endDate,
      deliveryPeriodVerified: n % 2 === 0,
      rate: rateMt,
      ratePerBasis: rateMt / 100,
      rateBasis: 'PER 10 KG',
      taxRate: 5,
      orderQty: c.qty,
      liftedQty: c.lifted,
      committedLiftQty: c.lifted,
      unit: 'MT',
      brokerName,
      brokeragePct: 0,
      brokeragePerTon: 65,
      sellerName: CURRENT_TRADER,
      buyerName: retailer.name,
      paymentTerms: 'Against delivery',
      status: orderStatus({ orderQty: c.qty, liftedQty: c.lifted }),
    })

    retailer.totalPurchases += c.qty * rateMt
    retailer.lastOrder = orderDate
    const broker = brokers.find(b => b.name === brokerName)
    if (broker) {
      broker.contracts += 1
      broker.commissionEarned += c.qty * 65
    }
  }

  const lifts: Lift[] = [
    {
      po: 1, so: 1, qty: 24.875, daysAgo: 100, invoice: 'INV-2026-0142', self: false,
      tankers: [
        { tankerNo: 'MH-12-AB-4521', transportName: 'Shree Transport', driverMobile: '9876543210', lrNo: 'LR-2026-0142', actualQtyMt: 24.875 },
      ],
    },
    {
      po: 2, so: 2, qty: 79.640, daysAgo: 95, invoice: 'INV-2026-0156', self: false,
      tankers: [
        { tankerNo: 'GJ-05-CD-8834', transportName: 'Gujarat Cargo Movers', driverMobile: '9825012345', lrNo: 'LR-2026-0156A', actualQtyMt: 39.820 },
        { tankerNo: 'GJ-05-CD-8835', transportName: 'Gujarat Cargo Movers', driverMobile: '9825012346', lrNo: 'LR-2026-0156B', actualQtyMt: 39.820 },
      ],
    },
    {
      po: 3, so: 3, qty: 39.950, daysAgo: 80, invoice: 'INV-2026-0188', self: true,
      tankers: [
        { tankerNo: 'MH-04-EF-2210', transportName: 'Self — buyer fleet', driverMobile: '9898989898', lrNo: 'LR-2026-0188', actualQtyMt: 39.950 },
      ],
    },
    {
      po: 6, so: 6, qty: 29.740, daysAgo: 50, invoice: 'INV-2026-0210', self: false,
      tankers: [
        { tankerNo: 'KA-41-GH-9901', transportName: 'Karnataka Hauliers', driverMobile: '9900112233', lrNo: 'LR-2026-0210', actualQtyMt: 29.740 },
      ],
    },
    {
      po: 9, so: 7, qty: 94.520, daysAgo: 35, invoice: 'INV-2026-0245', self: false,
      tankers: [
        { tankerNo: 'MH-14-JK-3344', transportName: 'Western Roadlines', driverMobile: '9765432100', lrNo: 'LR-2026-0245A', actualQtyMt: 47.260 },
        { tankerNo: 'MH-14-JK-3345', transportName: 'Western Roadlines', driverMobile: '9765432101', lrNo: 'LR-2026-0245B', actualQtyMt: 47.260 },
      ],
    },
    {
      po: 1, so: 1, qty: 10.000, daysAgo: 0, invoice: 'INV-2026-0301', self: false,
      tankers: [
        { tankerNo: 'MH-12-XX-1001', transportName: 'Shree Transport', driverMobile: '9876500001', lrNo: 'LR-2026-0301', actualQtyMt: 10.000 },
      ],
    },
    {
      po: 3, so: 3, qty: 5.000, daysAgo: 1, invoice: 'INV-2026-0302', self: false,
      tankers: [
        { tankerNo: 'MH-04-EF-3301', transportName: 'Self — buyer fleet', driverMobile: '9898989899', lrNo: 'LR-2026-0302', actualQtyMt: 5.000 },
      ],
    },
    {
      po: 1, so: 1, qty: 8.500, daysAgo: 2, invoice: 'INV-2026-0303', self: false,
      tankers: [
        { tankerNo: 'MH-12-XX-1002', transportName: 'Shree Transport', driverMobile: '9876500002', lrNo: 'LR-2026-0303', actualQtyMt: 8.500 },
      ],
    },
  ].map((l, i) => {
    const po = tradeOrders.find(o => o.ref === `PO-${l.po}`)!
    const so = tradeOrders.find(o => o.ref === `SO-${l.so}`)!
    const isPending = l.daysAgo <= 2
    const liftDate = dateOffset(l.daysAgo)
    return {
      id: id('lift', i + 1),
      liftRef: i + 1,
      poRef: po.ref,
      soRef: so.ref,
      date: liftDate,
      status: isPending ? 'pending' as const : 'delivered' as const,
      deliveredAt: isPending ? undefined : liftDate,
      buyerName: so.partyName,
      sellerName: po.partyName,
      itemName: po.itemName,
      deliveryPeriod: formatDeliveryPeriod(po),
      deliveryPeriodStart: po.deliveryPeriodStart,
      deliveryPeriodEnd: po.deliveryPeriodEnd,
      deliveryPeriodVerified: po.deliveryPeriodVerified,
      rate: so.rate,
      liftedQty: l.qty,
      tankerNo: l.tankers[0].tankerNo,
      tankers: l.tankers,
      salesInvoiceNo: isPending ? undefined : l.invoice,
      isSelfLift: l.self,
    }
  })

  const lots: Lot[] = tradeOrders
    .filter(o => o.side === 'purchase')
    .map(po => {
      const linkedSOs = tradeOrders.filter(o => o.side === 'sale' && o.poRef === po.ref)
      const allocated = linkedSOs.reduce((s, o) => s + o.orderQty, 0)
      const avgSoRate = linkedSOs.length
        ? linkedSOs.reduce((s, o) => s + o.rate, 0) / linkedSOs.length
        : 0
      const margin = avgSoRate > po.rate ? ((avgSoRate - po.rate) / po.rate) * 100 : 0
      return {
        id: id('lot', parseInt(po.ref.replace('PO-', ''), 10)),
        lotNumber: lotNumberForPO(po.ref),
        commodity: po.itemName,
        purchasePrice: po.rate,
        quantityPurchased: po.orderQty,
        remaining: Math.max(0, po.orderQty - po.liftedQty),
        allocated,
        available: Math.max(0, po.orderQty - allocated),
        unit: 'MT',
        producer: po.partyName,
        broker: po.brokerName,
        purchaseDate: po.date,
        contractId: po.id,
        margin: Math.round(margin * 10) / 10,
      }
    })

  const deliveries: Delivery[] = [
    { commodity: 'Palm Oil', qty: 25, status: 'in_transit' as const, daysAgo: 0, from: 'Navi Mumbai', to: 'Nagpur', truck: 'MH-12-AB-4521' },
    { commodity: 'Soybean Oil', qty: 40, status: 'upcoming' as const, daysAgo: -2, from: 'Haridwar', to: 'Bangalore', truck: 'UK-07-XY-1122' },
    { commodity: 'RBD Palmolein', qty: 30, status: 'upcoming' as const, daysAgo: -1, from: 'Navi Mumbai', to: 'Mumbai', truck: 'MH-43-ZZ-7788' },
    { commodity: 'Coconut Oil', qty: 15, status: 'delivered' as const, daysAgo: 3, from: 'Kakinada', to: 'Rajkot', truck: 'AP-05-LL-3344' },
    { commodity: 'Palm Oil', qty: 50, status: 'delayed' as const, daysAgo: 1, from: 'Ahmedabad', to: 'Delhi', truck: 'GJ-01-MM-5566' },
  ].map((d, i) => ({
    id: id('delivery', i + 1),
    contractRef: `PO-${i + 1}`,
    commodity: d.commodity,
    quantity: d.qty,
    unit: 'MT',
    status: d.status,
    scheduledDate: dateOffset(d.daysAgo),
    deliveredDate: d.status === 'delivered' ? dateOffset(d.daysAgo + 1) : undefined,
    from: d.from,
    to: d.to,
    truckNumber: d.truck,
    driverName: ['Ramesh Patil', 'Suresh Kumar', 'Amit Shah', 'Vikram Singh', 'Anil Desai'][i],
    driverPhone: `+91 98${200 + i}${1000 + i * 111}`,
  }))

  const activities: Activity[] = [
    ...lifts.slice(0, 3).map(l => ({
      id: id('act-lift', l.liftRef),
      type: 'lift_recorded' as const,
      title: 'Lift recorded',
      description: `Lift #${l.liftRef} — ${formatQty(l.liftedQty)} ${l.itemName} (${l.poRef} → ${l.soRef})`,
      timestamp: new Date(`${l.date}T10:00:00`).toISOString(),
      user: CURRENT_TRADER,
      entityRef: `Lift-${l.liftRef}`,
    })),
    ...tradeOrders.slice(0, 5).map((o, i) => ({
      id: id('act-order', i),
      type: (o.side === 'purchase' ? 'po_created' : 'so_created') as Activity['type'],
      title: o.side === 'purchase' ? 'PO created' : 'SO created',
      description: `${o.ref} — ${formatQty(o.orderQty)} ${o.itemName} @ ${formatContractRate(o.rate)}`,
      timestamp: new Date(`${o.date}T09:00:00`).toISOString(),
      user: CURRENT_TRADER,
      entityRef: o.ref,
    })),
  ].sort((a, b) => b.timestamp.localeCompare(a.timestamp))

  const dvcName = producers[0].name
  const payments: Payment[] = [
    {
      id: id('pay', 1),
      contractRef: 'PO-1',
      party: dvcName,
      type: 'partial',
      amount: 1_500_000,
      status: 'partial',
      dueDate: dateOffset(10),
      paidDate: dateOffset(5),
      method: 'NEFT',
    },
    {
      id: id('pay', 2),
      contractRef: 'PO-3',
      party: dvcName,
      type: 'partial',
      amount: 2_500_000,
      status: 'partial',
      dueDate: dateOffset(7),
      paidDate: dateOffset(3),
      method: 'RTGS',
    },
    {
      id: id('pay', 3),
      contractRef: 'SO-1',
      party: retailers[0].name,
      type: 'partial',
      amount: 800_000,
      status: 'partial',
      dueDate: dateOffset(8),
      paidDate: dateOffset(4),
      method: 'NEFT',
    },
  ]

  return {
    tradeOrders,
    lifts,
    lots,
    brokers,
    producers,
    retailers,
    companies,
    deliveries,
    activities,
    payments,
    spots: SPOTS,
    items: ITEMS,
    counters: { po: 20, so: 10, lift: 8, invoice: 303 },
  }
}

export const SEED_PRICE_TRENDS = [
  { date: '28 Jun', palmOil: 978, soybean: 912, coconut: 1115 },
  { date: '5 Jul', palmOil: 981, soybean: 918, coconut: 1120 },
  { date: '12 Jul', palmOil: 985, soybean: 921, coconut: 1128 },
  { date: '19 Jul', palmOil: 982, soybean: 926, coconut: 1132 },
  { date: '26 Jul', palmOil: 988, soybean: 928, coconut: 1135 },
  { date: '2 Aug', palmOil: 991, soybean: 931, coconut: 1140 },
  { date: '8 Aug', palmOil: 986, soybean: 929, coconut: 1138 },
]
