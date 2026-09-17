import type { ComponentType } from 'react'
import type { ServiceIssueKind } from '../../lib/serviceIssue'

type IllustrationProps = { className?: string }

function NotFoundScene({ className }: IllustrationProps) {
  return (
    <svg className={className} viewBox="0 0 320 220" fill="none" aria-hidden>
      <circle cx="160" cy="110" r="88" className="fill-accent/10 dark:fill-accent/15" />
      <rect x="88" y="52" width="144" height="116" rx="16" className="fill-white stroke-accent/45 dark:fill-zinc-900 dark:stroke-accent/50" strokeWidth="2" />
      <text x="160" y="118" textAnchor="middle" className="fill-accent dark:fill-accent text-[48px] font-bold" style={{ fontFamily: 'system-ui' }}>404</text>
      <circle cx="248" cy="68" r="22" className="fill-accent/20" />
      <path d="M238 68h20M248 58v20" className="stroke-accent" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

function NoInternetScene({ className }: IllustrationProps) {
  return (
    <svg className={className} viewBox="0 0 320 220" fill="none" aria-hidden>
      <circle cx="160" cy="120" r="90" className="fill-slate-500/10 dark:fill-slate-400/10" />
      <path d="M60 130c28-36 72-58 100-58s72 22 100 58" className="stroke-slate-400/60 dark:stroke-slate-500" strokeWidth="8" strokeLinecap="round" />
      <path d="M90 148c20-24 44-38 70-38s50 14 70 38" className="stroke-slate-500/70 dark:stroke-slate-400" strokeWidth="8" strokeLinecap="round" />
      <circle cx="160" cy="168" r="10" className="fill-slate-600 dark:fill-slate-300" />
      <path d="M118 118l84 84" className="stroke-rose-500" strokeWidth="10" strokeLinecap="round" />
    </svg>
  )
}

function ConnectivityScene({ className }: IllustrationProps) {
  return (
    <svg className={className} viewBox="0 0 320 220" fill="none" aria-hidden>
      <circle cx="160" cy="110" r="88" className="fill-amber-500/12 dark:fill-amber-400/10" />
      <ellipse cx="160" cy="148" rx="72" ry="28" className="fill-amber-500/15" />
      <path d="M110 92c16-22 40-34 50-34s34 12 50 34" className="stroke-amber-600/80 dark:stroke-amber-400" strokeWidth="6" strokeLinecap="round" />
      <rect x="128" y="118" width="64" height="48" rx="10" className="fill-white stroke-amber-500/50 dark:fill-zinc-900" strokeWidth="2" />
      <path d="M148 142h24" className="stroke-amber-600 dark:stroke-amber-400" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

function DatabaseScene({ className }: IllustrationProps) {
  return (
    <svg className={className} viewBox="0 0 320 220" fill="none" aria-hidden>
      <circle cx="160" cy="110" r="88" className="fill-rose-500/10 dark:fill-rose-400/10" />
      <ellipse cx="160" cy="88" rx="48" ry="14" className="fill-rose-500/25 stroke-rose-500/60" strokeWidth="2" />
      <path d="M112 88v56c0 8 21.5 14 48 14s48-6 48-14V88" className="fill-rose-500/15 stroke-rose-500/60" strokeWidth="2" />
      <ellipse cx="160" cy="144" rx="48" ry="14" className="fill-rose-500/20 stroke-rose-500/60" strokeWidth="2" />
      <path d="M128 108h64M128 128h64" className="stroke-rose-600/50 dark:stroke-rose-400/60" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

function ServerScene({ className }: IllustrationProps) {
  return (
    <svg className={className} viewBox="0 0 320 220" fill="none" aria-hidden>
      <circle cx="160" cy="110" r="88" className="fill-orange-500/10 dark:fill-orange-400/10" />
      <rect x="108" y="58" width="104" height="104" rx="12" className="fill-white stroke-orange-500/50 dark:fill-zinc-900" strokeWidth="2" />
      {[0, 1, 2].map(i => (
        <g key={i}>
          <circle cx="124" cy={82 + i * 28} r="4" className="fill-orange-500" />
          <rect x="136" y={76 + i * 28} width="60" height="12" rx="4" className="fill-orange-500/15" />
        </g>
      ))}
      <path d="M196 58l24-20v40l-24-20z" className="fill-orange-500/30 stroke-orange-500" strokeWidth="2" />
    </svg>
  )
}

function GenericScene({ className }: IllustrationProps) {
  return (
    <svg className={className} viewBox="0 0 320 220" fill="none" aria-hidden>
      <circle cx="160" cy="110" r="88" className="fill-zinc-500/10 dark:fill-zinc-400/10" />
      <circle cx="160" cy="110" r="52" className="fill-white stroke-zinc-400/60 dark:fill-zinc-900" strokeWidth="2" />
      <path d="M160 86v30M160 130v6" className="stroke-zinc-600 dark:stroke-zinc-300" strokeWidth="8" strokeLinecap="round" />
    </svg>
  )
}

const SCENES: Record<ServiceIssueKind, ComponentType<IllustrationProps>> = {
  no_internet: NoInternetScene,
  connectivity: ConnectivityScene,
  database: DatabaseScene,
  not_found: NotFoundScene,
  server: ServerScene,
  generic: GenericScene,
}

export function ServiceIssueIllustration({
  kind,
  className = 'mx-auto h-44 w-full max-w-[280px]',
}: {
  kind: ServiceIssueKind
  className?: string
}) {
  const Scene = SCENES[kind]
  return <Scene className={className} />
}
