import { ArrowDown, Sparkles } from 'lucide-react'
import { useState, type MouseEvent } from 'react'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { cn } from '../lib/utils'
import { Marquee } from './Marquee'
import { ProductPreview } from './ProductPreview'

const chips = [
  { label: 'On hand', value: '186 MT' },
  { label: 'To lift', value: '92 MT' },
  { label: 'In transit', value: '4 tankers' },
]

export function Hero() {
  const reduced = usePrefersReducedMotion()
  const [shift, setShift] = useState({ x: 0, y: 0 })

  function onMove(e: MouseEvent<HTMLElement>) {
    if (reduced) return
    const r = e.currentTarget.getBoundingClientRect()
    setShift({
      x: ((e.clientX - r.left) / r.width - 0.5) * 18,
      y: ((e.clientY - r.top) / r.height - 0.5) * 12,
    })
  }

  return (
    <section
      className="relative min-h-[100svh] overflow-hidden bg-ink text-white"
      onMouseMove={onMove}
      onMouseLeave={() => setShift({ x: 0, y: 0 })}
    >
      <div
        className="absolute -inset-[4%] will-change-transform"
        style={{
          transform: reduced ? undefined : `translate3d(${shift.x}px, ${shift.y}px, 0)`,
          transition: 'transform 0.45s ease-out',
        }}
      >
        <img
          src="/images/hero-terminal.jpg"
          alt=""
          width={1920}
          height={1080}
          fetchPriority="high"
          className={cn('h-full w-full object-cover', !reduced && 'hero-kenburns')}
        />
      </div>

      <div className="absolute inset-0 bg-gradient-to-r from-ink/88 via-ink/55 to-ink/20" />
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-ink/45" />
      <div className="pointer-events-none absolute left-[-10%] top-[20%] h-[28rem] w-[28rem] rounded-full bg-accent/25 blur-3xl" />
      <div className="film-grain" />

      <div className="relative z-10 mx-auto grid max-w-6xl gap-10 px-4 pb-28 pt-28 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-8 lg:min-h-[100svh]">
        <div>
          <p className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5 text-white" aria-hidden />
            Built for edible oil traders
          </p>
          <h1 className="animate-fade-up mt-5 text-5xl font-semibold tracking-tight text-white drop-shadow-[0_12px_32px_rgba(0,0,0,0.55)] sm:text-6xl lg:text-[4.35rem] lg:leading-[1.05] [animation-delay:80ms]">
            Run every trade
            <span className="block text-white">from one desk.</span>
          </h1>
          <p className="animate-fade-up mt-5 max-w-xl text-lg leading-relaxed text-white/85 [animation-delay:140ms]">
            Purchase orders, sales orders, and tanker lifts in one register — so remaining-to-lift
            isn’t buried in WhatsApp threads and spreadsheets.
          </p>

          <div className="animate-fade-up mt-8 flex flex-wrap gap-3 [animation-delay:200ms]">
            {chips.map(chip => (
              <div
                key={chip.label}
                className="rounded-lg border border-accent/30 bg-ink/50 px-4 py-3 backdrop-blur-md"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">{chip.label}</p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums text-white">{chip.value}</p>
              </div>
            ))}
          </div>

          <div className="animate-fade-up mt-8 flex flex-wrap items-center gap-3 [animation-delay:260ms]">
            <a
              href="#demo"
              className="btn-glow inline-flex h-12 items-center rounded-md bg-accent px-6 text-sm font-semibold text-white hover:bg-accent-hover hover:-translate-y-0.5 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Request a demo
            </a>
            <a
              href="#how-it-works"
              className="inline-flex h-12 items-center rounded-md border border-white/25 bg-white/10 px-6 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/20 transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              See how it works
            </a>
          </div>
        </div>

        <div className={cn('mt-2 lg:mt-0', !reduced && 'hero-float')}>
          <div className="rounded-xl shadow-[0_30px_80px_rgba(62,96,213,0.28)] ring-1 ring-white/25">
            <ProductPreview compact />
          </div>
        </div>
      </div>

      <a
        href="#story"
        className="absolute bottom-20 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-white/70 hover:text-white sm:flex cursor-pointer"
      >
        Scroll
        <ArrowDown className="h-4 w-4" aria-hidden />
      </a>

      <div className="absolute inset-x-0 bottom-0 z-10">
        <Marquee />
      </div>
    </section>
  )
}
