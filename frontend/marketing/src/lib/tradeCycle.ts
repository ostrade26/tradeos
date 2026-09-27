import {
  ClipboardList,
  FileText,
  MapPin,
  Package,
  PenLine,
  Receipt,
  ShoppingBag,
  Truck,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

export type TradeCycleStage = {
  id: string
  label: string
  body: string
  story: string
  artifact: string
  icon: LucideIcon
}

export const TRADE_CYCLE: TradeCycleStage[] = [
  {
    id: 'deal',
    label: 'Deal',
    body: 'Capture the commercial agreement.',
    story: 'A supplier and a buyer agree on product, quantity, and rate.',
    artifact: '100 MT agreed',
    icon: PenLine,
  },
  {
    id: 'contract',
    label: 'Contract',
    body: 'Keep agreed terms, quantities, rates and documents connected.',
    story: 'Terms land on the book, with the original document still attached.',
    artifact: 'Contract on file',
    icon: FileText,
  },
  {
    id: 'purchase',
    label: 'Purchase order',
    body: 'Turn a supplier commitment into a trackable purchase.',
    story: 'The buy side becomes a purchase order with remaining-to-lift.',
    artifact: 'PO-1042 · 100 MT',
    icon: ClipboardList,
  },
  {
    id: 'sales',
    label: 'Sales order',
    body: 'Turn a customer commitment into a trackable sale.',
    story: 'The same stock can cover more than one customer order.',
    artifact: 'SO-2218 · 40 · SO-2220 · 60',
    icon: ShoppingBag,
  },
  {
    id: 'movement',
    label: 'Movement',
    body: 'Track what physically moved — not just what was ordered.',
    story: 'A lift records the load — including when it fulfils several sales orders.',
    artifact: 'Lift · 40.0 MT planned',
    icon: Truck,
  },
  {
    id: 'inventory',
    label: 'Inventory',
    body: 'Know what stock is available, where it came from, and where it is going.',
    story: 'The lot shows what arrived, what is allocated, and what is still available.',
    artifact: 'Lot · 60 MT remaining',
    icon: Package,
  },
  {
    id: 'delivery',
    label: 'Delivery',
    body: 'Connect physical fulfilment back to the original orders.',
    story: 'Actual quantity is captured and remaining-to-lift on those orders updates.',
    artifact: 'Delivered · 39.8 MT actual',
    icon: MapPin,
  },
  {
    id: 'invoice',
    label: 'Invoice',
    body: 'Keep invoice numbers connected to the underlying lift and orders.',
    story: 'The invoice number sits on the lift, tied to the same trade.',
    artifact: 'INV-188 on the lift',
    icon: Receipt,
  },
  {
    id: 'payment',
    label: 'Payment',
    body: 'See what is outstanding on customers and suppliers from the trade book.',
    story: 'What is due on the buyer and supplier stays visible on the book.',
    artifact: 'Outstanding on the book',
    icon: Wallet,
  },
]

export const TRADE_CYCLE_ACTS = [
  {
    id: 'agree',
    title: 'Agree',
    caption: 'The commercial terms are captured.',
    stageIds: ['deal', 'contract'] as const,
  },
  {
    id: 'commit',
    title: 'Commit',
    caption: 'One purchase can supply several sales.',
    stageIds: ['purchase', 'sales'] as const,
  },
  {
    id: 'move',
    title: 'Move',
    caption: 'What physically moved is reconciled to the orders.',
    stageIds: ['movement', 'inventory', 'delivery'] as const,
  },
  {
    id: 'settle',
    title: 'Settle',
    caption: 'Billing and outstanding stay attached to the trade.',
    stageIds: ['invoice', 'payment'] as const,
  },
] as const

export const PRODUCT_CATEGORIES = [
  'Edible oil',
  'Grains & pulses',
  'Chemicals',
  'Metals',
  'Construction materials',
  'Packaging',
  'Industrial products',
  'Agricultural products',
  'Wholesale distribution',
]
