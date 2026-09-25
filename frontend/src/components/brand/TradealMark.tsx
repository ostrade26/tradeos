import { cn } from '../../lib/utils'
import blueUrl from '../../assets/tradeal-mark-blue.png'
import blackUrl from '../../assets/tradeal-mark-black.png'
import whiteUrl from '../../assets/tradeal-mark-white.png'

/** Which mark keeps contrast on the surface behind it. */
export type TradealMarkTone = 'auto' | 'black' | 'white' | 'blue'

type TradealMarkProps = {
  className?: string
  title?: string
  /**
   * `auto` — blue on white, white in dark mode.
   * `blue` — white backgrounds.
   * `white` — colourful or dark backgrounds.
   * `black` — held for surfaces where the brand blue would not read.
   */
  tone?: TradealMarkTone
}

const SRC: Record<Exclude<TradealMarkTone, 'auto'>, string> = {
  black: blackUrl,
  white: whiteUrl,
  blue: blueUrl,
}

/**
 * Tradeal monogram. Blue on white, white on colourful or dark surfaces.
 * Size with className — `h-8 w-8`.
 */
export function TradealMark({ className, title = 'Tradeal', tone = 'auto' }: TradealMarkProps) {
  const imgClass = cn('shrink-0 object-contain', className)

  if (tone === 'auto') {
    return (
      <>
        <img
          src={blueUrl}
          alt={title}
          width={32}
          height={32}
          draggable={false}
          className={cn(imgClass, 'dark:hidden')}
        />
        <img
          src={whiteUrl}
          alt=""
          width={32}
          height={32}
          draggable={false}
          aria-hidden
          className={cn(imgClass, 'hidden dark:block')}
        />
      </>
    )
  }

  return (
    <img
      src={SRC[tone]}
      alt={title}
      width={32}
      height={32}
      draggable={false}
      className={imgClass}
    />
  )
}
