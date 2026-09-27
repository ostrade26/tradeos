import { Link } from 'react-router-dom'
import { useState, type MouseEvent } from 'react'
import heroBg from '../../public/images/tanker-lift.jpg'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { cn } from '../lib/utils'
import { Marquee } from './Marquee'
import { ProductPreview } from './ProductPreview'

export function Hero() {
  const reduced = usePrefersReducedMotion()
  const [shift, setShift] = useState({ x: 0, y: 0 })

  function onMove(e: MouseEvent<HTMLElement>) {
    if (reduced) return
    const r = e.currentTarget.getBoundingClientRect()
    setShift({
      x: ((e.clientX - r.left) / r.width - 0.5) * 16,
      y: ((e.clientY - r.top) / r.height - 0.5) * 10,
    })
  }

  return (
    <section
      className="relative flex min-h-[100svh] flex-col overflow-hidden bg-ink text-white"
      onMouseMove={onMove}
      onMouseLeave={() => setShift({ x: 0, y: 0 })}
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div
          className="absolute -inset-[6%]"
          style={{
            transform: reduced ? undefined : `translate3d(${shift.x}px, ${shift.y}px, 0)`,
            transition: 'transform 0.45s ease-out',
          }}
        >
          <img
            src={heroBg}
            alt=""
            width={1920}
            height={1280}
            fetchPriority="high"
            className={cn('h-full w-full object-cover object-[68%_center]', !reduced && 'hero-kenburns')}
          />
        </div>
        <div className="absolute inset-0 bg-ink/45" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/78 to-ink/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/20 to-ink/60" />
        <div className="hero-grid absolute inset-0" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-[88rem] flex-1 items-center px-4 py-20 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid w-full gap-10 lg:grid-cols-[minmax(0,30rem)_minmax(0,1fr)] lg:items-center lg:gap-10 xl:grid-cols-[minmax(0,32rem)_minmax(0,1fr)]">
          <div>
            <p className="animate-fade-up inline-flex items-center rounded-full border border-accent/40 bg-accent/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
              B2B Trade Operations Platform
            </p>
            <h1 className="animate-fade-up mt-5 text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-[3.35rem] lg:leading-[1.08] [animation-delay:80ms]">
              Turn complex trade into a clear, connected workflow.
            </h1>
            <p className="animate-fade-up mt-5 max-w-xl text-lg leading-relaxed text-white/85 [animation-delay:140ms]">
              Tradeal helps businesses manage buying, selling, inventory movement, deliveries,
              documents, and payments — all in one connected place.
            </p>
            <div className="animate-fade-up mt-8 flex flex-wrap items-center gap-3 [animation-delay:220ms]">
              <a
                href="#demo"
                className="btn-glow inline-flex h-12 items-center rounded-md bg-accent px-6 text-sm font-semibold text-white hover:bg-accent-hover cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Get started
              </a>
              <a
                href="#cycle"
                className="inline-flex h-12 items-center rounded-md border border-white/25 bg-white/10 px-6 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/20 transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Explore Tradeal
              </a>
              <Link
                to="/login"
                className="inline-flex h-12 items-center text-sm font-semibold text-white/85 hover:text-white underline-offset-4 hover:underline cursor-pointer"
              >
                Sign in
              </Link>
            </div>
          </div>

          <div
            className={cn(
              'min-w-0 w-full lg:justify-self-stretch',
              'rounded-xl shadow-[0_28px_70px_rgba(0,0,0,0.45)] ring-1 ring-white/20',
              !reduced && 'hero-float',
            )}
          >
            <ProductPreview compact />
          </div>
        </div>
      </div>

      <div className="relative z-10">
        <Marquee />
      </div>
    </section>
  )
}
