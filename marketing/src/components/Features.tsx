import { FileUp, Inbox, MessageCircle, Package, Scale, ScrollText } from 'lucide-react'
import { Reveal } from './Reveal'

const features = [
  {
    icon: ScrollText,
    title: 'Purchase and sales registers',
    body: 'Every PO and SO with quantity ordered, lifted, and still due — so the desk can see remaining-to-lift without opening a chat.',
  },
  {
    icon: Scale,
    title: 'Tanker lifts across orders',
    body: 'Dispatch one tanker against several SOs, split the load in MT, then mark delivered when actual weight is confirmed.',
  },
  {
    icon: Package,
    title: 'Lot inventory',
    body: 'What is on hand, what is available to sell, and which lots are running low — in the same book as the orders.',
  },
  {
    icon: FileUp,
    title: 'Broker contract PDF import',
    body: 'Drop the contract. TradeOS reads parties, item, rate, and quantity so the order is not retyped from a printout.',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp share',
    body: 'Send a lift or order summary in the format the market already uses — without rewriting tanker numbers and qty.',
  },
  {
    icon: Inbox,
    title: 'Action inbox',
    body: 'Pending lifts, unlinked SOs, and low stock for today, in one list. Ask the assistant what is still owed to a seller.',
  },
]

export function Features() {
  return (
    <section id="product" className="border-t border-gray-200 bg-body">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">Product</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-heading sm:text-4xl">
            The register, the tanker, and the lot — together.
          </h2>
          <p className="mt-4 max-w-2xl text-muted leading-relaxed">
            TradeOS is the operating desk: capture the contract, dispatch the lift, and close the lot
            without a second system for each step.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <Reveal key={feature.title} delay={i * 70}>
              <article className="group h-full rounded-xl border border-gray-200 bg-white p-7 shadow-[var(--shadow-card)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-accent/30 hover:shadow-md">
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-white shadow-[0_10px_28px_rgba(62,96,213,0.28)] transition-transform duration-200 group-hover:-translate-y-0.5">
                  <feature.icon className="h-8 w-8" aria-hidden />
                </span>
                <h3 className="mt-5 text-lg font-semibold text-heading">{feature.title}</h3>
                <p className="mt-2 text-sm text-muted leading-relaxed">{feature.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
