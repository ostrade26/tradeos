import { cn } from '../lib/utils'
import blueUrl from '../assets/tradeal-mark-blue.png'
import whiteUrl from '../assets/tradeal-mark-white.png'

export function Logo({ className, light = false }: { className?: string; light?: boolean }) {
  return (
    <a href="#top" className={cn('flex items-center gap-2.5 min-w-0 cursor-pointer', className)}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
        <img
          src={light ? whiteUrl : blueUrl}
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
