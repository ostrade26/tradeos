import { Reveal } from './Reveal'

const steps = [
  {
    n: '01',
    title: 'Capture the contract',
    body: 'Import a broker PDF or enter the PO and SO. Parties, item, rate, quantity, and delivery period land in the register.',
    image: '/images/trading-desk.jpg',
    alt: 'Trading desk with order registers on screen',
  },
  {
    n: '02',
    title: 'Dispatch the tanker',
    body: 'Create a lift, split one tanker across sales orders, and track planned vs actual MT until it is marked delivered.',
    image: '/images/tanker-lift.jpg',
    alt: 'Tanker at the weighbridge ready for dispatch',
  },
  {
    n: '03',
    title: 'Close the lot',
    body: 'Inventory, remaining-to-lift, and today’s inbox update together — so the next trade starts from a clean book.',
    image: '/images/oil-tanks.jpg',
    alt: 'Edible oil storage tanks at night',
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-ink text-white">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">How it works</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Three steps the desk already knows.
          </h2>
          <p className="mt-4 max-w-2xl text-white/70 leading-relaxed">
            TradeOS does not invent a new workflow. It holds the one you run every day, without the
            copy-paste between tools.
          </p>
        </Reveal>

        <ol className="mt-12 grid gap-5 lg:grid-cols-3">
          {steps.map((step, i) => (
            <Reveal key={step.n} delay={i * 90}>
              <li className="group relative min-h-[22rem] overflow-hidden rounded-2xl">
                <img
                  src={step.image}
                  alt={step.alt}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/55 to-ink/15" />
                <div className="relative flex h-full min-h-[22rem] flex-col justify-end p-6">
                  <p className="text-sm font-semibold tabular-nums tracking-wider text-accent">{step.n}</p>
                  <h3 className="mt-2 text-2xl font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm text-white/75 leading-relaxed">{step.body}</p>
                </div>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  )
}
