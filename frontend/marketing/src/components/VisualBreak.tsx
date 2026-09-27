import { cn } from '../lib/utils'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'

export function VisualBreak({
  src,
  title,
  caption,
  position = 'center',
}: {
  src: string
  title: string
  caption: string
  position?: string
}) {
  const reduced = usePrefersReducedMotion()

  return (
    <section className="relative isolate min-h-[28rem] overflow-hidden sm:min-h-[36rem] lg:min-h-[42rem]" aria-hidden={false}>
      <div className="absolute -inset-[5%]">
        <img
          src={src}
          alt=""
          className={cn(
            'h-full w-full object-cover',
            !reduced && 'hero-kenburns',
          )}
          style={{ objectPosition: position }}
          loading="lazy"
        />
      </div>
      <div className="absolute inset-0 bg-ink/45" />
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/25 to-ink/40" />
      <div className="relative z-10 mx-auto flex min-h-[28rem] max-w-6xl items-end px-4 py-16 sm:min-h-[36rem] sm:px-6 lg:min-h-[42rem] lg:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">{title}</p>
          <p className="mt-2 max-w-xl text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {caption}
          </p>
        </div>
      </div>
    </section>
  )
}
