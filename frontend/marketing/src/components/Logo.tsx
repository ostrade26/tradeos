import { cn } from '../lib/utils'
import markUrl from '../assets/tradeal-mark-square.png'

export function Logo({ className, light = false }: { className?: string; light?: boolean }) {
  return (
    <a href="#top" className={cn('flex items-center gap-2.5 min-w-0 cursor-pointer', className)}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md shadow-[0_0_16px_rgba(62,96,213,0.45)]">
        <img
          src={markUrl}
          alt=""
          width={32}
          height={32}
          draggable={false}
          className="h-8 w-8 object-contain"
          aria-hidden
        />
      </span>
      <span className={cn('text-lg font-semibold tracking-tight', light ? 'text-white' : 'text-heading')}>
        Tradeal
      </span>
    </a>
  )
}
