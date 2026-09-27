import { Reveal } from './Reveal'
import { SectionHeading } from './SectionHeading'

const before = ['WhatsApp', 'Excel', 'PDFs', 'Email', 'Calls', 'Accounting software', 'Manual follow-ups']

const after = ['Deal', 'Order', 'Movement', 'Inventory', 'Delivery', 'Invoice', 'Payment']

export function Problem() {
  return (
    <section id="chaos" className="border-t border-gray-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <Reveal>
          <SectionHeading eyebrow="The problem" title="From chaos to control.">
            <p>
              B2B trade involves too many connected activities, people, documents, quantities, rates,
              movements, and payments. The pieces often live separately. Tradeal connects them.
            </p>
          </SectionHeading>
        </Reveal>

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          <Reveal>
            <div className="h-full rounded-2xl border border-gray-200 bg-body p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Before Tradeal</p>
              <p className="mt-2 text-lg font-semibold text-heading">Too many places to check what happened.</p>
              <ul className="mt-5 flex flex-wrap gap-2">
                {before.map(item => (
                  <li
                    key={item}
                    className="chip-pop rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-heading cursor-default"
                  >
                    {item}
                  </li>
                ))}
              </ul>
              <ul className="mt-6 space-y-2 text-sm text-muted">
                <li>Disconnected information</li>
                <li>Manual reconciliation</li>
                <li>Unclear status</li>
                <li>Missed follow-ups</li>
                <li>Difficult reporting</li>
              </ul>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <div className="h-full rounded-2xl border border-accent/20 bg-accent-muted p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-accent">With Tradeal</p>
              <p className="mt-2 text-lg font-semibold text-heading">One connected trade workflow.</p>
              <ol className="mt-5 flex flex-wrap items-center gap-2 text-sm font-medium text-heading">
                {after.map((item, i) => (
                  <li key={item} className="flex items-center gap-2">
                    <span className="rounded-md bg-white px-2.5 py-1 shadow-[var(--shadow-card)] chip-pop">{item}</span>
                    {i < after.length - 1 ? <span className="text-accent" aria-hidden>→</span> : null}
                  </li>
                ))}
              </ol>
              <ul className="mt-6 space-y-2 text-sm text-heading/80">
                <li>One operational view</li>
                <li>Connected records</li>
                <li>Clear status</li>
                <li>Traceable activity</li>
                <li>Better control</li>
              </ul>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
