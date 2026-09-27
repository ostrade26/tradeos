import { Reveal } from './Reveal'
import { SectionHeading } from './SectionHeading'

const points = [
  {
    title: 'One purchase → multiple sales',
    body: 'A single purchase can supply several customer orders. Tradeal keeps remaining-to-lift on the purchase and allocations on the sales side in the same book.',
    visual: [
      { label: 'Purchase', value: '100 units' },
      { label: 'Customer A', value: '40' },
      { label: 'Customer B', value: '30' },
      { label: 'Customer C', value: '30' },
    ],
  },
  {
    title: 'One movement → multiple orders',
    body: 'A physical lift or shipment can fulfil more than one sales order. Split quantity on the lift; remaining-to-lift on each order updates when you mark it delivered.',
    visual: [
      { label: 'Lift', value: '40.0 MT' },
      { label: 'SO-101', value: '24.0' },
      { label: 'SO-102', value: '16.0' },
    ],
  },
  {
    title: 'Planned ≠ actual',
    body: 'A planned quantity can differ from what was received or delivered. Planned vs actual stays on the lift, with variance visible in reports.',
    visual: [
      { label: 'Planned', value: '10.00 MT' },
      { label: 'Actual', value: '9.80 MT' },
      { label: 'Variance', value: '−0.20 MT' },
    ],
  },
  {
    title: 'Documents become transactions',
    body: 'Contracts and PDFs often hold the terms. Upload, review extracted parties, item, rate and quantity, then keep the original document connected to the order.',
    visual: [
      { label: 'Upload', value: 'PDF' },
      { label: 'Review', value: 'Extracted fields' },
      { label: 'Record', value: 'PO / SO' },
    ],
  },
]

export function Testimonials() {
  return (
    <section id="complexity" className="border-t border-gray-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <Reveal>
          <SectionHeading eyebrow="Why trade is different" title="Because what was ordered isn't always what moved.">
            <p>
              Different lots can arrive at different purchase rates. Physical movement does not always
              follow commercial order sequence. Tradeal is built around that operational complexity.
            </p>
          </SectionHeading>
        </Reveal>

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          {points.map((point, i) => (
            <Reveal key={point.title} delay={i * 60}>
              <article className="lift-card h-full rounded-2xl border border-gray-200 bg-body p-6">
                <h3 className="text-lg font-semibold text-heading">{point.title}</h3>
                <p className="mt-2 text-sm text-muted leading-relaxed">{point.body}</p>
                <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {point.visual.map(cell => (
                    <div key={cell.label} className="rounded-lg bg-white px-3 py-3">
                      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted">{cell.label}</dt>
                      <dd className="mt-1 text-sm font-semibold tabular-nums text-heading">{cell.value}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
