import { ArrowRight, FileUp } from 'lucide-react'
import { Reveal } from './Reveal'
import { SectionHeading } from './SectionHeading'

const steps = ['Upload document', 'Extract information', 'Review', 'Create or update the transaction', 'Keep the original connected']

const inventory = [
  { label: 'Purchased', value: '100.0' },
  { label: 'Remaining', value: '42.0' },
  { label: 'Allocated', value: '28.0' },
  { label: 'Available', value: '14.0' },
]

const chain = ['Supplier', 'Purchase order', 'Incoming movement', 'Inventory lot', 'Sales orders', 'Deliveries']

export function WhatIs() {
  return (
    <section id="what-is" className="border-t border-gray-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <Reveal>
          <SectionHeading eyebrow="Orders and inventory" title="Connect what you buy with what you sell.">
            <p>
              Purchase orders track commitments to suppliers. Sales orders track customer
              commitments. Inventory connects supply and demand. Physical movement connects
              commercial orders with what actually moved.
            </p>
          </SectionHeading>
        </Reveal>

        <Reveal delay={60}>
          <ol className="mt-10 flex flex-wrap items-center gap-2">
            {chain.map((item, i) => (
              <li key={item} className="flex items-center gap-2">
                <span className="chip-pop rounded-md border border-gray-200 bg-body px-3 py-2 text-sm font-semibold text-heading">
                  {item}
                </span>
                {i < chain.length - 1 ? (
                  <ArrowRight className="h-4 w-4 text-accent" aria-hidden />
                ) : null}
              </li>
            ))}
          </ol>
        </Reveal>

        <div className="mt-14 grid gap-8 lg:grid-cols-2">
          <Reveal>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-accent">Inventory with context</p>
              <h3 className="mt-2 text-2xl font-semibold text-heading">Not just how much stock you have.</h3>
              <p className="mt-3 text-sm text-muted leading-relaxed">
                Know how stock entered the business, what is allocated to sales, and what remains
                available — at lot level, with purchase-rate context.
              </p>
              <dl className="mt-6 grid grid-cols-2 gap-3">
                {inventory.map(row => (
                  <div key={row.label} className="lift-card rounded-xl border border-gray-200 bg-body px-4 py-4">
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted">{row.label}</dt>
                    <dd className="mt-1 text-xl font-semibold tabular-nums text-heading">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-accent">Documents</p>
              <h3 className="mt-2 text-2xl font-semibold text-heading">Turn trade documents into usable business data.</h3>
              <p className="mt-3 text-sm text-muted leading-relaxed">
                Contracts, PDFs and confirmations often arrive by email. Tradeal can read parties,
                item, rate, and quantity so you review before the order is created. Extraction is a
                starting point — you remain in control of what is saved.
              </p>
              <ol className="mt-6 space-y-3">
                {steps.map((step, i) => (
                  <li key={step} className="flex items-start gap-3 text-sm text-heading">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-muted text-accent">
                      {i === 0 ? <FileUp className="h-4 w-4" aria-hidden /> : (
                        <span className="text-xs font-semibold tabular-nums">{i + 1}</span>
                      )}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
