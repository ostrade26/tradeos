import { PRODUCT_CATEGORIES } from '../lib/tradeCycle'
import { Reveal } from './Reveal'
import { SectionHeading } from './SectionHeading'

export function Industries() {
  return (
    <section id="industries" className="border-t border-gray-200 bg-body">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <Reveal>
          <SectionHeading
            eyebrow="Industries"
            title="Different products. Different businesses. Similar operational complexity."
          >
            <p>
              Whether you trade oil, grains, chemicals or industrial products, the underlying
              challenge remains the same: keeping purchases, sales, inventory, movement and
              fulfilment connected.
            </p>
          </SectionHeading>
        </Reveal>
        <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
          {PRODUCT_CATEGORIES.map((name, i) => (
            <Reveal key={name} delay={i * 30}>
              <article className="lift-card rounded-xl border border-gray-200 bg-white px-4 py-5">
                <h3 className="text-sm font-semibold text-heading">{name}</h3>
                <p className="mt-1.5 text-xs text-muted leading-relaxed">
                  Same buy, sell, move, and close loop — not a specialised industry module.
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
