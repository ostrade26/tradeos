import rocketPng from './release-update-rocket.png'

/** Product-update header art — Storyset Pana rocket (PNG, aspect locked). */
export function ReleaseUpdateIllustration({
  className,
  alt = '',
}: {
  className?: string
  alt?: string
}) {
  return (
    <img
      src={rocketPng}
      alt={alt}
      width={500}
      height={500}
      decoding="async"
      draggable={false}
      className={className}
    />
  )
}
