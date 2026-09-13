import { useState, type MouseEvent } from 'react'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { ProductPreview } from './ProductPreview'
import { Reveal } from './Reveal'

export function PreviewSection() {
  const reduced = usePrefersReducedMotion()
  const [tilt, setTilt] = useState({ x: 0, y: 0 })

  function onMove(e: MouseEvent<HTMLDivElement>) {
    if (reduced) return
    const r = e.currentTarget.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    setTilt({ x: py * -8, y: px * 10 })
  }

  return (
    <section className="relative overflow-hidden border-t border-gray-200 bg-body">
      <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-accent/8 to-transparent" />
      <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">On the desk</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-heading sm:text-4xl">
            Today’s book, before the first tanker leaves.
          </h2>
          <p className="mt-4 max-w-2xl text-muted leading-relaxed">
            Inventory value, pending POs and SOs, lifts in transit, and the actions that still need
            a person — the same language the trading floor already uses.
          </p>
        </Reveal>
        <Reveal delay={120}>
          <div
            className="mt-10"
            onMouseMove={onMove}
            onMouseLeave={() => setTilt({ x: 0, y: 0 })}
            style={{
              transform: `perspective(1200px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
              transition: 'transform 0.25s ease-out',
            }}
          >
            <ProductPreview />
          </div>
        </Reveal>
      </div>
    </section>
  )
}
