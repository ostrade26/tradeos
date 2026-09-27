import { useState } from 'react'
import { Reveal } from './Reveal'
import { SectionHeading } from './SectionHeading'
import { cn } from '../lib/utils'

const groups = [
  {
    id: 'buying',
    label: 'Buying',
    items: [
      'Purchase orders with quantity ordered, lifted, and still due',
      'Supplier parties in the directory',
      'Contracts and purchase documents on the order',
      'Purchase quantities and rates on the register',
    ],
  },
  {
    id: 'selling',
    label: 'Selling',
    items: [
      'Sales orders with remaining-to-lift',
      'Customer parties in the directory',
      'Fulfilment through lifts linked to sales orders',
      'Delivery status when a lift is marked delivered',
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    items: [
      'Lot-level inventory with purchased, remaining, allocated, and available quantity',
      'Stock movement from lifts',
      'Purchase-rate context on the lot',
      'Planned vs actual quantity on the lift',
    ],
  },
  {
    id: 'movement',
    label: 'Physical movement',
    items: [
      'Lifts and shipments against one or more sales orders',
      'Quantity allocation on the lift',
      'Actual quantity capture',
      'Variance in the lift report',
    ],
  },
  {
    id: 'documents',
    label: 'Documents',
    items: [
      'Contract PDFs on the trade',
      'Upload and review extracted parties, item, rate, and quantity',
      'Keep the original document connected to the transaction',
      'Share order and lift summaries on WhatsApp',
    ],
  },
  {
    id: 'relationships',
    label: 'Relationships',
    items: [
      'Customers and suppliers as parties',
      'Brokers in the directory',
      'Other counterparties on the same book',
    ],
  },
  {
    id: 'payments',
    label: 'Payments',
    items: [
      'Invoice numbers recorded on lifts',
      'Customer outstanding and supplier outstanding reports',
      'Payment reconciliation report',
      'Tradeal does not collect online payments or replace accounting software',
    ],
  },
  {
    id: 'reports',
    label: 'Reports & audit',
    items: [
      'Purchase and sales registers',
      'Inventory movement, lift, delivery, and variance reports',
      'Outstanding, payment reconciliation, trade profitability, and landed cost',
      'Audit trail, document completeness, and exception reporting',
    ],
  },
] as const

export function Features() {
  const [active, setActive] = useState<(typeof groups)[number]['id']>('buying')
  const current = groups.find(g => g.id === active) ?? groups[0]

  return (
    <section id="product" className="border-t border-gray-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <Reveal>
          <SectionHeading eyebrow="Product" title="Everything that belongs on the trade book.">
            <p>
              Capture the contract, dispatch the movement, close the lot. Tradeal is the register,
              the lift, and inventory together — with remaining-to-lift as the number that keeps the
              desk honest.
            </p>
          </SectionHeading>
        </Reveal>

        <Reveal delay={60}>
          <div className="mt-10 -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            {groups.map(group => (
              <button
                key={group.id}
                type="button"
                onClick={() => setActive(group.id)}
                className={cn(
                  'h-11 shrink-0 rounded-md px-4 text-sm font-medium whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                  active === group.id
                    ? 'bg-accent text-white'
                    : 'border border-gray-200 bg-white text-heading hover:bg-gray-50',
                )}
              >
                {group.label}
              </button>
            ))}
          </div>
          <div className="mt-6 rounded-2xl border border-gray-200 bg-body p-6 transition-shadow duration-200">
            <h3 className="text-lg font-semibold text-heading">{current.label}</h3>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {current.items.map(item => (
                <li key={item} className="flex gap-3 text-sm text-muted leading-relaxed transition-colors duration-150 hover:text-heading">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
