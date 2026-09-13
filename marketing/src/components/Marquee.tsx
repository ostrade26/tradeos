const items = [
  'Palm oil',
  'Soybean oil',
  'RBD palmolein',
  'Sunflower oil',
  'Coconut oil',
  'Rice bran oil',
  'Kolhapur',
  'Mumbai',
  'Surat',
  'Navi Mumbai',
  'Weighbridge actuals',
  'Tanker splits',
]

export function Marquee() {
  const loop = [...items, ...items]

  return (
    <div className="relative overflow-hidden border-t border-white/10 bg-ink/55 py-3 backdrop-blur-md">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-ink/80 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-ink/80 to-transparent" />
      <div className="marquee-track flex w-max gap-10 px-6 hover:[animation-play-state:paused]">
        {loop.map((item, i) => (
          <span key={`${item}-${i}`} className="flex items-center gap-10 text-sm font-medium tracking-wide text-white/80">
            {item}
            <span className="h-1 w-1 rounded-full bg-accent" aria-hidden />
          </span>
        ))}
      </div>
    </div>
  )
}
