import type { AddOnIllustrationKind } from '../../lib/featureOfferVisuals'
import { cn } from '../../lib/utils'

type Props = {
  kind: AddOnIllustrationKind
  className?: string
}

/** Decorative hero art — reads as a product image without external assets. */
export function AddOnOfferHeroIllustration({ kind, className }: Props) {
  return (
    <svg
      className={cn('pointer-events-none select-none drop-shadow-lg', className)}
      viewBox="0 0 200 140"
      fill="none"
      aria-hidden
    >
      {kind === 'ai' ? <AiScene /> : null}
      {kind === 'analytics' ? <AnalyticsScene /> : null}
      {kind === 'connect' ? <ConnectScene /> : null}
      {kind === 'ops' ? <OpsScene /> : null}
      {kind === 'spark' ? <SparkScene /> : null}
    </svg>
  )
}

function AiScene() {
  return (
    <>
      <ellipse cx="130" cy="118" rx="52" ry="14" className="fill-black/15" />
      <rect x="72" y="36" width="88" height="72" rx="18" className="fill-white/90 stroke-white/50" strokeWidth="2" />
      <circle cx="116" cy="68" r="14" className="fill-violet-400/80" />
      <circle cx="104" cy="66" r="2" className="fill-white" />
      <circle cx="112" cy="66" r="2" className="fill-white" />
      <path d="M104 78q12 8 24 0" className="stroke-white/90" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path
        d="M48 52l16-10 8 18 20-28 14 22"
        className="stroke-white/70"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {[0, 1, 2].map(i => (
        <circle key={i} cx={36 + i * 14} cy={28 + (i % 2) * 6} r="3" className="fill-white/60" />
      ))}
    </>
  )
}

function AnalyticsScene() {
  return (
    <>
      <ellipse cx="128" cy="118" rx="50" ry="12" className="fill-black/12" />
      <rect x="78" y="44" width="84" height="58" rx="12" className="fill-white/92 stroke-white/45" strokeWidth="2" />
      <path d="M92 88V72l14 10 16-22 18 28" className="stroke-cyan-500" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="92" cy="72" r="3" className="fill-cyan-400" />
      <circle cx="106" cy="82" r="3" className="fill-sky-400" />
      <circle cx="122" cy="60" r="3" className="fill-blue-400" />
      <circle cx="140" cy="88" r="3" className="fill-indigo-400" />
      <rect x="52" y="58" width="22" height="22" rx="6" className="fill-white/35 stroke-white/50" strokeWidth="1.5" />
    </>
  )
}

function ConnectScene() {
  return (
    <>
      <ellipse cx="130" cy="118" rx="48" ry="12" className="fill-black/12" />
      <circle cx="118" cy="70" r="26" className="fill-white/25 stroke-white/60" strokeWidth="2" />
      <circle cx="148" cy="86" r="18" className="fill-white/90 stroke-white/50" strokeWidth="2" />
      <path d="M136 78l18 10" className="stroke-white" strokeWidth="3" strokeLinecap="round" />
      <path d="M70 50h28M70 62h20M70 74h24" className="stroke-white/75" strokeWidth="3" strokeLinecap="round" />
      <rect x="58" y="42" width="8" height="8" rx="2" className="fill-amber-200/90" />
    </>
  )
}

function OpsScene() {
  return (
    <>
      <ellipse cx="128" cy="118" rx="54" ry="13" className="fill-black/12" />
      <path
        d="M62 96h76l-10-28H72l-10 28z"
        className="fill-white/90 stroke-white/50"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <rect x="88" y="68" width="28" height="18" rx="4" className="fill-emerald-300/90" />
      <circle cx="78" cy="98" r="8" className="fill-white/80 stroke-white/60" strokeWidth="2" />
      <circle cx="122" cy="98" r="8" className="fill-white/80 stroke-white/60" strokeWidth="2" />
      <path d="M148 58l12-8v20l-12-8V58z" className="fill-white/40" />
    </>
  )
}

function SparkScene() {
  return (
    <>
      <ellipse cx="130" cy="118" rx="50" ry="12" className="fill-black/12" />
      <circle cx="118" cy="72" r="34" className="fill-white/20 stroke-white/45" strokeWidth="2" />
      {[0, 1, 2, 3, 4].map(i => {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2
        const x1 = 118 + Math.cos(a) * 22
        const y1 = 72 + Math.sin(a) * 22
        const x2 = 118 + Math.cos(a) * 38
        const y2 = 72 + Math.sin(a) * 38
        return (
          <path
            key={i}
            d={`M${x1} ${y1}L${x2} ${y2}`}
            className="stroke-white/85"
            strokeWidth="3"
            strokeLinecap="round"
          />
        )
      })}
      <circle cx="118" cy="72" r="10" className="fill-white/90" />
    </>
  )
}
