import { cn } from '../../lib/utils'
import markUrl from '../../assets/tradeal-mark-square.png'

type TradealMarkProps = {
  className?: string
  title?: string
}

/**
 * Tradeal monogram. Uses the source PNG (transparent) so curves stay sharp.
 * For recolouring later, drop in a designer-exported SVG and swap this component.
 * Size with className — `h-8 w-8` matches the app brand mark slot.
 */
export function TradealMark({ className, title = 'Tradeal' }: TradealMarkProps) {
  return (
    <img
      src={markUrl}
      alt={title}
      width={32}
      height={32}
      draggable={false}
      className={cn('shrink-0 object-contain', className)}
    />
  )
}
