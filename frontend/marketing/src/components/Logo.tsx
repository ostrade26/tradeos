import { cn } from '../lib/utils'

export function Logo({ className, light = false }: { className?: string; light?: boolean }) {
  return (
    <a href="#top" className={cn('flex items-center gap-2.5 min-w-0 cursor-pointer', className)}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent shadow-[0_0_16px_rgba(62,96,213,0.45)]">
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden>
          <path d="M2 12L7 7L10 10L14 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className={cn('text-lg font-semibold tracking-tight', light ? 'text-white' : 'text-heading')}>
        Tradeal
      </span>
    </a>
  )
}
