import { Reveal } from './Reveal'
import { SectionHeading } from './SectionHeading'

const accounting = [
  'Accounts and ledgers',
  'Tax and financial statements',
  'Bookkeeping',
]

const tradeal = [
  'Commercial commitments and contracts',
  'Purchase and sales orders',
  'Physical movement and inventory allocation',
  'Delivery, trade documents, and operational reconciliation',
]

export function Accounting() {
  return (
    <section id="accounting" className="border-t border-gray-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <Reveal>
          <SectionHeading eyebrow="Alongside your books" title="Tradeal manages the trade. Your accounting system manages the books.">
            <p>
              Billing software records transactions. Accounting software manages financial books.
              Tradeal manages the operational trade cycle connecting commercial commitments with
              physical execution.
            </p>
          </SectionHeading>
        </Reveal>
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          <Reveal>
            <div className="lift-card h-full rounded-2xl border border-gray-200 bg-body p-6">
              <h3 className="text-lg font-semibold text-heading">Accounting software</h3>
              <ul className="mt-4 space-y-2 text-sm text-muted">
                {accounting.map(item => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <div className="lift-card h-full rounded-2xl border border-accent/20 bg-accent-muted p-6">
              <h3 className="text-lg font-semibold text-heading">Tradeal</h3>
              <ul className="mt-4 space-y-2 text-sm text-heading/80">
                {tradeal.map(item => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
