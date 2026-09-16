import { MessageSquare, Scale, FileText, Truck } from 'lucide-react'
import { Reveal } from './Reveal'

const pains = [
  {
    icon: MessageSquare,
    title: 'Registers live in chats',
    body: 'The latest PO qty is in a WhatsApp forward. The SO against it is in another group. Nobody has the book.',
  },
  {
    icon: Scale,
    title: 'Remaining-to-lift is tribal knowledge',
    body: 'What is still due on a seller, or still to dispatch to a buyer, sits in someone’s head until it doesn’t.',
  },
  {
    icon: Truck,
    title: 'Tankers don’t fit a spreadsheet row',
    body: 'One tanker covers three SOs. Actual weight comes in after weighbridge. The sheet is already stale.',
  },
  {
    icon: FileText,
    title: 'Contracts get retyped',
    body: 'Broker PDFs are printed, highlighted, and keyed in again — parties, item, rate, and period, every time.',
  },
]

export function Problem() {
  return (
    <section className="relative overflow-hidden bg-ink text-white" id="story">
      <img
        src="/images/tanker-lift.jpg"
        alt="Edible oil tanker at a weighbridge at dusk"
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover opacity-35"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/88 to-ink/70" />
      <div className="film-grain" />

      <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">The problem</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Most desks still run on chats and Excel.
          </h2>
          <p className="mt-4 max-w-2xl text-white/70 leading-relaxed">
            Tradeal is built for the way edible oil actually moves: producers, brokers, retailers,
            spots like Kolhapur and Navi Mumbai, and lifts that close only when the tanker is weighed.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {pains.map((pain, i) => (
            <Reveal key={pain.title} delay={i * 80}>
              <div className="group h-full rounded-xl border border-white/10 bg-white/10 p-6 backdrop-blur-sm transition-transform duration-200 hover:-translate-y-1 hover:border-accent/50 hover:bg-white/15">
                <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-accent text-white shadow-[0_8px_24px_rgba(62,96,213,0.35)]">
                  <pain.icon className="h-7 w-7" aria-hidden />
                </span>
                <h3 className="mt-5 text-lg font-semibold text-white">{pain.title}</h3>
                <p className="mt-2 text-sm text-white/70 leading-relaxed">{pain.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
