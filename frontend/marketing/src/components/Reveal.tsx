import type { CSSProperties, ReactNode } from 'react'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { useInView } from '../hooks/useInView'
import { cn } from '../lib/utils'

export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  const reduced = usePrefersReducedMotion()
  const { ref, inView } = useInView<HTMLDivElement>()

  return (
    <div
      ref={ref}
      className={cn(!reduced && 'reveal', (inView || reduced) && 'is-in', className)}
      style={{ transitionDelay: reduced ? undefined : `${delay}ms` } as CSSProperties}
    >
      {children}
    </div>
  )
}
