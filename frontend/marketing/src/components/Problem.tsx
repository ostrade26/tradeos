import {
  ArrowRight,
  FileText,
  Mail,
  MessageCircle,
  Phone,
  Sheet,
} from 'lucide-react'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { cn } from '../lib/utils'
import { Reveal } from './Reveal'
import { SectionHeading } from './SectionHeading'

const fragments = [
  {
    icon: MessageCircle,
    channel: 'WhatsApp',
    line: '40 MT today — which SO?',
    place: 'lg:top-0 lg:left-0 lg:-rotate-3',
    delay: '0s',
  },
  {
    icon: Sheet,
    channel: 'Excel',
    line: 'PO-1042 · remaining ???',
    place: 'lg:top-2 lg:right-0 lg:rotate-2',
    delay: '0.4s',
  },
  {
    icon: FileText,
    channel: 'PDF',
    line: 'Contract is a file, not on the order.',
    place: 'lg:top-[9.5rem] lg:left-0 lg:rotate-1',
    delay: '0.8s',
  },
  {
    icon: Phone,
    channel: 'Call',
    line: 'Has the tanker lifted?',
    place: 'lg:top-[15.25rem] lg:right-0 lg:-rotate-2',
    delay: '1.2s',
  },
  {
    icon: Mail,
    channel: 'Email',
    line: 'Need the invoice number for this lift.',
    place: 'lg:bottom-2 lg:left-0 lg:right-auto lg:rotate-1',
    delay: '1.6s',
  },
]

const connected = [
  { label: 'Deal', value: 'Contract on PO-1042 · 100 MT' },
  { label: 'Order', value: 'Remaining-to-lift 60.0 MT' },
  { label: 'Movement', value: 'L-188 · 40.0 MT against SO-2218' },
  { label: 'Inventory', value: 'Lot remaining follows the lift' },
  { label: 'Delivery', value: 'Marked delivered when it actually moved' },
  { label: 'Settle', value: 'Invoice number on the lift · outstanding on the book' },
]

export function Problem() {
  const reduced = usePrefersReducedMotion()

  return (
    <section id="chaos" className="border-t border-gray-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <Reveal>
          <SectionHeading eyebrow="The problem" title="From chaos to control.">
            <p>
              The trade is one job. WhatsApp, Excel, PDFs, calls, and the books each hold a slice —
              so remaining-to-lift lives in someone’s head.
            </p>
          </SectionHeading>
        </Reveal>

        <Reveal delay={80}>
          <div className="mt-12 overflow-hidden rounded-2xl border border-gray-200 lg:grid lg:grid-cols-2">
            <div className="relative bg-ink px-6 py-8 text-white sm:px-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/50">Same trade · in pieces</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight">Nobody has the whole picture.</h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-white/70">
                Quantity, the lift, the document, and the invoice chase sit in different tools. Status
                is a conversation, not a number.
              </p>

              <ul className="relative mt-8 grid gap-3 lg:min-h-[28rem] lg:pb-1">
                {fragments.map(item => (
                  <li
                    key={item.channel}
                    className={cn('lg:absolute lg:w-[min(100%,13.25rem)]', item.place)}
                  >
                    <div
                      className={cn(
                        'rounded-xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm',
                        !reduced && 'chaos-drift',
                      )}
                      style={{ animationDelay: reduced ? undefined : item.delay }}
                    >
                      <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/55">
                        <item.icon className="h-3.5 w-3.5 text-white/70" aria-hidden />
                        {item.channel}
                      </p>
                      <p className="mt-1.5 text-sm font-medium leading-snug text-white">{item.line}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-gray-200 bg-body px-6 py-8 sm:px-8 lg:border-t-0 lg:border-l">
              <p className="text-xs font-semibold uppercase tracking-wider text-accent">Same trade · on the book</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-heading">One connected workflow.</h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
                PO-1042 still shows what was bought, what moved, and what is still due — attached to
                the lift, the lot, and the invoice number.
              </p>

              <p className="mt-8 text-[11px] font-semibold uppercase tracking-wider text-muted">Remaining to lift</p>
              <p className="mt-1 text-4xl font-semibold tabular-nums tracking-tight text-heading">60.0 MT</p>
              <p className="mt-1 text-sm text-muted">of 100.0 MT on PO-1042 · 40.0 MT already lifted</p>

              <ol className="relative mt-8 space-y-0">
                <span
                  className="pointer-events-none absolute left-[0.7rem] top-2 bottom-2 w-px bg-accent/35"
                  aria-hidden
                />
                {!reduced ? (
                  <span
                    className="cycle-flow-dot pointer-events-none absolute left-[0.48rem] h-2 w-2 rounded-full bg-accent shadow-[0_0_0_3px_rgba(62,96,213,0.25)]"
                    aria-hidden
                  />
                ) : null}
                {connected.map((step, i) => (
                  <li key={step.label} className="relative flex gap-4 py-2.5">
                    <span className="relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-muted text-[10px] font-semibold tabular-nums text-accent">
                      {i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="text-xs font-semibold uppercase tracking-wider text-accent">{step.label}</span>
                      <span className="mt-0.5 block text-sm font-medium text-heading">{step.value}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </Reveal>

        <Reveal delay={140}>
          <p className="mt-8 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>The work is not collecting more files.</span>
            <ArrowRight className="h-4 w-4 text-accent" aria-hidden />
            <span className="font-medium text-heading">It is keeping remaining-to-lift, the lift, and the lot in agreement.</span>
          </p>
        </Reveal>
      </div>
    </section>
  )
}
