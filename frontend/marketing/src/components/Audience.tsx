import {
  Factory,
  Landmark,
  Package,
  Ship,
  Store,
  Truck,
  Warehouse,
} from 'lucide-react'
import { Reveal } from './Reveal'
import { SectionHeading } from './SectionHeading'

const audiences = [
  {
    icon: Warehouse,
    title: 'Wholesalers',
    body: 'Manage purchases, sales, inventory, movements and customer fulfilment.',
  },
  {
    icon: Truck,
    title: 'Distributors',
    body: 'Connect incoming stock with outgoing customer orders and deliveries.',
  },
  {
    icon: Landmark,
    title: 'Traders',
    body: 'Track contracts, orders, quantities, rates, movements and remaining-to-lift.',
  },
  {
    icon: Store,
    title: 'Dealers',
    body: 'Keep customer orders, supplier purchases and inventory connected.',
  },
  {
    icon: Ship,
    title: 'Importers',
    body: 'Organise supplier transactions, incoming stock, documents and downstream sales.',
  },
  {
    icon: Package,
    title: 'B2B suppliers',
    body: 'Manage repeat customers, orders, fulfilment and outstanding visibility.',
  },
  {
    icon: Factory,
    title: 'Manufacturers with trading operations',
    body: 'Keep trading and distribution workflows organised alongside your core operations.',
  },
]

export function Audience() {
  return (
    <section id="who" className="border-t border-gray-200 bg-body">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <Reveal>
          <SectionHeading
            eyebrow="Built for B2B trade"
            title="Built for businesses that move products and manage complex trade."
          >
            <p>
              Tradeal is designed for businesses where buying and selling is only part of the job.
              Track the commercial transaction, the physical movement, the inventory, the documents,
              and the money connected to it.
            </p>
          </SectionHeading>
        </Reveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {audiences.map((item, i) => (
            <Reveal key={item.title} delay={i * 50}>
              <article className="lift-card group h-full rounded-xl border border-gray-200 bg-white p-6">
                <span className="icon-pop flex h-10 w-10 items-center justify-center rounded-lg bg-accent-muted text-accent">
                  <item.icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-4 text-base font-semibold text-heading">{item.title}</h3>
                <p className="mt-2 text-sm text-muted leading-relaxed">{item.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
