import type { ComponentType } from 'react'
import type { AnnouncementVariant } from '../../lib/announcementTheme'

type IllustrationProps = { className?: string; version?: string }

function ReleaseScene({ className, version }: IllustrationProps) {
  return (
    <svg className={className} viewBox="0 0 320 200" fill="none" aria-hidden>
      <circle cx="160" cy="100" r="80" className="fill-accent/12 dark:fill-accent/18" />
      <path
        d="M160 44l28 72h-56L160 44z"
        className="fill-accent/25 stroke-accent dark:stroke-accent"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <rect x="136" y="112" width="48" height="56" rx="8" className="fill-white stroke-accent/50 dark:fill-zinc-900" strokeWidth="2" />
      <path d="M124 148c-20 8-32 24-32 24s28-4 48-16M196 148c20 8 32 24 32 24s-28-4-48-16" className="stroke-accent/40" strokeWidth="3" strokeLinecap="round" />
      {version ? (
        <text x="160" y="142" textAnchor="middle" className="fill-accent text-[15px] font-bold" style={{ fontFamily: 'system-ui' }}>
          v{version}
        </text>
      ) : null}
    </svg>
  )
}

function FeatureScene({ className }: IllustrationProps) {
  return (
    <svg className={className} viewBox="0 0 320 200" fill="none" aria-hidden>
      <circle cx="160" cy="100" r="80" className="fill-accent/12" />
      {[0, 1, 2, 3].map(i => {
        const angle = (i * Math.PI) / 2
        const cx = 160 + Math.cos(angle) * 52
        const cy = 100 + Math.sin(angle) * 52
        return (
          <path
            key={i}
            d={`M${cx} ${cy}l8-14 8 14-14 2 2 14-8-10-8 10 2-14-14-2z`}
            className="fill-accent/35 stroke-accent"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        )
      })}
      <circle cx="160" cy="100" r="22" className="fill-accent/30 stroke-accent" strokeWidth="2" />
    </svg>
  )
}

function UpdateScene({ className }: IllustrationProps) {
  return (
    <svg className={className} viewBox="0 0 320 200" fill="none" aria-hidden>
      <circle cx="160" cy="100" r="80" className="fill-accent/12" />
      <ellipse cx="160" cy="148" rx="56" ry="16" className="fill-accent/15" />
      <rect x="108" y="72" width="104" height="72" rx="14" className="fill-white stroke-accent/45 dark:fill-zinc-900" strokeWidth="2" />
      <path d="M128 96h64M128 116h48M128 136h56" className="stroke-accent/50" strokeWidth="4" strokeLinecap="round" />
      <circle cx="232" cy="68" r="18" className="fill-accent stroke-white dark:stroke-zinc-900" strokeWidth="3" />
      <path d="M226 68h12M232 62v12" className="stroke-white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

const SCENES: Record<AnnouncementVariant, ComponentType<IllustrationProps>> = {
  release: ReleaseScene,
  feature: FeatureScene,
  update: UpdateScene,
}

export function AnnouncementIllustration({
  variant,
  version,
  className = 'mx-auto h-36 w-full max-w-[260px]',
}: {
  variant: AnnouncementVariant
  version?: string
  className?: string
}) {
  const Scene = SCENES[variant]
  return <Scene className={className} version={version} />
}
