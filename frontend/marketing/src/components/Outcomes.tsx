import { Reveal } from './Reveal'
import { SectionHeading } from './SectionHeading'

const benefits = [
  {
    title: 'Reduce manual coordination',
    body: 'Keep trade information connected instead of scattered across spreadsheets, PDFs and messages.',
  },
  {
    title: 'Improve visibility',
    body: 'See the status of purchases, sales, inventory and movement in one place.',
  },
  {
    title: 'Reduce reconciliation work',
    body: 'Connect commercial orders with physical movement and actual quantities.',
  },
  {
    title: 'Improve accountability',
    body: 'Know who created, updated or acted on a transaction from the activity log.',
  },
  {
    title: 'Find information faster',
    body: 'Keep documents, orders, inventory and transactions connected.',
  },
  {
    title: 'Make better operational decisions',
    body: 'Understand what is committed, what is moving, what is available and what remains.',
  },
]

export function Outcomes() {
  return (
    <section id="results" className="border-t border-gray-200 bg-body">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <Reveal>
          <SectionHeading eyebrow="Why teams use Tradeal" title="Less chase. Same workflow. A cleaner book.">
            <p>
              Tradeal does not add a second process. It stops quantity, lifts, and inventory living
              in three places.
            </p>
          </SectionHeading>
        </Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((item, i) => (
            <Reveal key={item.title} delay={i * 40}>
              <article className="lift-card h-full rounded-xl border border-gray-200 bg-white p-6">
                <h3 className="text-base font-semibold text-heading">{item.title}</h3>
                <p className="mt-2 text-sm text-muted leading-relaxed">{item.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
