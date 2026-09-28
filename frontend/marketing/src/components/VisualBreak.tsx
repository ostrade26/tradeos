import type { ReactNode } from 'react'
import { cn } from '../lib/utils'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'

export function VisualBreak({
  src,
  title,
  caption,
  position = 'center',
  align = 'end',
  children,
  id,
}: {
  src?: string
  title: string
  caption: string
  position?: string
  align?: 'end' | 'center'
  children?: ReactNode
  id?: string
}) {
  const reduced = usePrefersReducedMotion()
  const centered = align === 'center'

  return (
    <section
      id={id}
      className="relative isolate min-h-[28rem] overflow-hidden sm:min-h-[36rem] lg:min-h-[42rem]"
    >
      {children ? (
        <div className="absolute inset-0 bg-[#eef0f5]" aria-hidden>
          <div className="absolute left-1/2 top-[12%] w-[88rem] max-w-none -translate-x-1/2 px-6 pointer-events-none">
            <div className={cn(!reduced && 'hero-kenburns')}>
              {children}
            </div>
          </div>
        </div>
      ) : src ? (
        <div className="absolute -inset-[5%]">
          <img
            src={src}
            alt=""
            className={cn('h-full w-full object-cover', !reduced && 'hero-kenburns')}
            style={{ objectPosition: position }}
            loading="lazy"
          />
        </div>
      ) : null}
      <div className={cn('absolute inset-0', children ? 'bg-ink/50' : 'bg-ink/45')} />
      <div
        className={cn(
          'absolute inset-0',
          children
            ? 'bg-[radial-gradient(ellipse_at_center,rgba(11,18,32,0.62),rgba(11,18,32,0.42))]'
            : 'bg-gradient-to-t from-ink via-ink/25 to-ink/40',
        )}
      />
      <div
        className={cn(
          'relative z-10 mx-auto flex min-h-[28rem] max-w-6xl px-4 py-16 sm:min-h-[36rem] sm:px-6 lg:min-h-[42rem] lg:px-8',
          centered ? 'items-center justify-center text-center' : 'items-end',
        )}
      >
        <div className={cn(centered && 'mx-auto flex max-w-2xl flex-col items-center gap-5')}>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">{title}</p>
          <p
            className={cn(
              'max-w-xl text-2xl font-semibold tracking-tight text-white sm:text-3xl sm:leading-snug',
              !centered && 'mt-2',
              centered && 'mx-auto max-w-2xl drop-shadow-[0_8px_28px_rgba(0,0,0,0.45)]',
            )}
          >
            {caption}
          </p>
        </div>
      </div>
    </section>
  )
}
