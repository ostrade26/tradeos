import { Reveal } from './Reveal'
import { SectionHeading } from './SectionHeading'
import { TradeCycleFlow } from './TradeCycleFlow'

export function HowItWorks() {
  return (
    <section id="cycle" className="bg-ink text-white">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <Reveal>
          <SectionHeading light eyebrow="The trade cycle" title="One connected trade cycle.">
            <p>
              Follow one trade through the book: agree the terms, commit the buy and the sell, move
              the stock, then settle. Each step stays attached to the last.
            </p>
          </SectionHeading>
        </Reveal>
        <Reveal delay={80}>
          <div className="mt-12">
            <TradeCycleFlow light />
          </div>
        </Reveal>
      </div>
    </section>
  )
}
