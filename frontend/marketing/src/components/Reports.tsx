import { Reveal } from './Reveal'
import { SectionHeading } from './SectionHeading'

const groups = [
  {
    title: 'Trade activity',
    items: ['Purchase register', 'Sales register', 'Contract summary'],
  },
  {
    title: 'Inventory',
    items: ['Stock reconciliation', 'Inventory movement', 'Lot-level visibility'],
  },
  {
    title: 'Movement',
    items: ['Lift report', 'Delivery report', 'Quantity variance'],
  },
  {
    title: 'Commercial',
    items: ['Customer and supplier outstanding', 'Payment reconciliation', 'Trade profitability', 'Landed cost'],
  },
  {
    title: 'Audit',
    items: ['Audit trail', 'Document completeness', 'Transaction exceptions', 'Rate-change report'],
  },
]

export function Reports() {
  return (
    <section id="reports" className="border-t border-gray-200 bg-body">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <Reveal>
          <SectionHeading eyebrow="Reports" title="From transactions to business visibility.">
            <p>Reports should explain what happened — not just show numbers.</p>
          </SectionHeading>
        </Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group, i) => (
            <Reveal key={group.title} delay={i * 50}>
              <article className="h-full rounded-xl border border-gray-200 bg-white p-6 lift-card">
                <h3 className="text-base font-semibold text-heading">{group.title}</h3>
                <ul className="mt-4 space-y-2 text-sm text-muted">
                  {group.items.map(item => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
