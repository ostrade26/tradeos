import { Reveal } from './Reveal'
import { SectionHeading } from './SectionHeading'

const faqs = [
  {
    q: 'What is Tradeal?',
    a: 'Tradeal is a B2B trade operations platform. It helps businesses manage buying, selling, inventory movement, deliveries, documents, and outstanding amounts in one connected workflow.',
  },
  {
    q: 'Who is Tradeal for?',
    a: 'Wholesalers, distributors, traders, dealers, importers, B2B suppliers, and manufacturers that also run significant trading or distribution operations.',
  },
  {
    q: 'What types of businesses can use Tradeal?',
    a: 'Small to mid-sized B2B businesses that handle physical products, multiple customers and suppliers, and cases where one purchase can support multiple sales.',
  },
  {
    q: 'Is Tradeal an accounting software?',
    a: 'No. Tradeal manages the operational trade cycle. Your accounting system still manages ledgers, tax, and financial statements. They are complementary.',
  },
  {
    q: 'Can Tradeal manage purchase and sales orders?',
    a: 'Yes. Purchase and sales registers track quantity ordered, lifted, and still due, with remaining-to-lift on the order.',
  },
  {
    q: 'Can Tradeal track inventory?',
    a: 'Yes. Lot-level inventory shows purchased, remaining, allocated, and available quantity, connected to orders and lifts.',
  },
  {
    q: 'Can Tradeal track physical movement?',
    a: 'Yes. Lifts record planned and actual quantity and can be split across sales orders until marked delivered.',
  },
  {
    q: 'Can Tradeal handle multiple customers and suppliers?',
    a: 'Yes. Parties and brokers live in the directory and attach to contracts, orders, and lifts.',
  },
  {
    q: 'Can Tradeal work alongside accounting software?',
    a: 'Yes. Invoice numbers can be recorded on lifts, and outstanding and payment-reconciliation reports sit on the trade book. Tradeal does not replace accounting software.',
  },
  {
    q: 'Does Tradeal support different industries?',
    a: 'Tradeal is built around how trade works, not a single commodity. Edible oil, grains, chemicals, metals, and other wholesale products use the same operational loop.',
  },
  {
    q: 'How does Tradeal handle user access?',
    a: 'Organisation users are Admin, Operator, or View only. Organisations are isolated from each other. Activity is recorded on an audit trail.',
  },
]

export function Faq() {
  return (
    <section id="faq" className="border-t border-gray-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <Reveal>
          <SectionHeading eyebrow="FAQ" title="Straight answers." />
        </Reveal>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {faqs.map((item, i) => (
            <Reveal key={item.q} delay={i * 40}>
              <article className="lift-card h-full rounded-xl border border-gray-200 bg-body p-6">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">
                  {String(i + 1).padStart(2, '0')}
                </p>
                <h3 className="mt-2 text-base font-semibold text-heading leading-snug">{item.q}</h3>
                <p className="mt-3 text-sm text-muted leading-relaxed">{item.a}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
