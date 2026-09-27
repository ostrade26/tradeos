import { Reveal } from './Reveal'
import { SectionHeading } from './SectionHeading'
import { ProductPreview } from './ProductPreview'

export function PreviewSection() {
  return (
    <section id="dashboard" className="border-t border-gray-200 bg-body">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <Reveal>
          <SectionHeading eyebrow="Visibility" title="Know what is happening across your trade.">
            <p>
              Active purchases and sales, inventory on hand, lifts in transit, and today’s inbox —
              the same language the floor already uses.
            </p>
          </SectionHeading>
        </Reveal>
        <Reveal delay={80}>
          <div className="mt-12 origin-center">
            <ProductPreview />
          </div>
        </Reveal>
      </div>
    </section>
  )
}
