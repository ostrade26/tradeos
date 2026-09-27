import { type ReactNode } from 'react'
import { TRADE_CYCLE, TRADE_CYCLE_ACTS } from '../lib/tradeCycle'
import { cn } from '../lib/utils'

function stageById(id: string) {
  return TRADE_CYCLE.find(s => s.id === id)!
}

export function TradeCycleFlow({
  compact = false,
  light = false,
}: {
  compact?: boolean
  light?: boolean
}) {
  if (compact) return <CompactCycle light={light} />
  return <StoryCycle light={light} />
}

function CompactCycle({ light }: { light: boolean }) {
  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Trade cycle">
      {TRADE_CYCLE_ACTS.map((act, i) => (
        <li
          key={act.id}
          className={cn(
            'relative rounded-xl border px-3 py-3',
            light ? 'border-white/15 bg-white/5' : 'border-gray-200 bg-white',
          )}
        >
          {i < TRADE_CYCLE_ACTS.length - 1 ? (
            <span
              className="absolute -right-2 top-1/2 z-10 hidden h-px w-4 bg-accent sm:block"
              aria-hidden
            />
          ) : null}
          <p className="text-[10px] font-semibold uppercase tracking-wider text-accent">
            {String(i + 1).padStart(2, '0')} · {act.title}
          </p>
          <ul className="mt-2 space-y-0.5">
            {act.stageIds.map(id => (
              <li key={id} className={cn('text-xs font-medium', light ? 'text-white/90' : 'text-heading')}>
                {stageById(id).label}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  )
}

function StoryCycle({ light }: { light: boolean }) {
  const agree = TRADE_CYCLE_ACTS[0].stageIds.map(stageById)
  const commit = TRADE_CYCLE_ACTS[1].stageIds.map(stageById)
  const move = TRADE_CYCLE_ACTS[2].stageIds.map(stageById)
  const settle = TRADE_CYCLE_ACTS[3].stageIds.map(stageById)

  return (
    <ol className="relative space-y-10" aria-label="Trade cycle story">
      <span
        className={cn(
          'pointer-events-none absolute left-5 top-5 bottom-6 w-px sm:left-[4.25rem]',
          light ? 'bg-accent/50' : 'bg-accent/35',
        )}
        aria-hidden
      />
      <span
        className="cycle-flow-dot pointer-events-none absolute left-[1.05rem] top-12 h-2.5 w-2.5 rounded-full bg-white shadow-[0_0_0_3px_rgba(62,96,213,0.5)] sm:left-[4.05rem]"
        aria-hidden
      />
      <Act
        light={light}
        index={1}
        title="Agree"
        caption="Capture the commercial terms."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {agree.map((stage, i) => (
            <Station key={stage.id} stage={stage} light={light} n={i + 1} />
          ))}
        </div>
      </Act>

      <Act
        light={light}
        index={2}
        title="Commit"
        caption="One purchase can supply several sales."
      >
        <div className="grid gap-3 lg:grid-cols-[1fr_7.5rem_1fr] lg:items-stretch">
          <Station stage={commit[0]} light={light} n={3} />
          <ForkCaption light={light} />
          <Station stage={commit[1]} light={light} n={4} />
        </div>
      </Act>

      <Act
        light={light}
        index={3}
        title="Move"
        caption="What was ordered is reconciled with what physically moved."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {move.map((stage, i) => (
            <Station key={stage.id} stage={stage} light={light} n={5 + i} />
          ))}
        </div>
      </Act>

      <Act
        light={light}
        index={4}
        title="Settle"
        caption="Invoice and outstanding stay on the same trade."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {settle.map((stage, i) => (
            <Station key={stage.id} stage={stage} light={light} n={8 + i} />
          ))}
        </div>
      </Act>
    </ol>
  )
}

function ForkCaption({ light }: { light: boolean }) {
  return (
    <div className="flex items-center justify-center py-1 lg:flex-col lg:py-0">
      <span className={cn('hidden h-px w-8 bg-accent lg:block lg:h-8 lg:w-px', light && 'bg-accent/70')} aria-hidden />
      <p className="px-2 text-center text-[11px] font-semibold uppercase tracking-wider text-accent">
        supplies
      </p>
      <span className={cn('hidden h-px w-8 bg-accent lg:block lg:h-8 lg:w-px', light && 'bg-accent/70')} aria-hidden />
    </div>
  )
}

function Act({
  index,
  title,
  caption,
  light,
  children,
}: {
  index: number
  title: string
  caption: string
  light: boolean
  children: ReactNode
}) {
  return (
    <li className="relative grid grid-cols-[2.5rem_1fr] gap-4 sm:grid-cols-[8.5rem_1fr] sm:gap-8">
      <div className="relative flex flex-col items-center sm:w-[8.5rem]">
        <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold tabular-nums text-white">
          {String(index).padStart(2, '0')}
        </span>
      </div>
      <div className="min-w-0 pb-2">
        <p className={cn('text-sm font-semibold', light ? 'text-white' : 'text-heading')}>{title}</p>
        <p className={cn('mt-0.5 text-xs leading-relaxed', light ? 'text-white/55' : 'text-muted')}>{caption}</p>
        <div className="mt-4">{children}</div>
      </div>
    </li>
  )
}

function Station({
  stage,
  light,
  n,
}: {
  stage: (typeof TRADE_CYCLE)[number]
  light: boolean
  n: number
}) {
  const Icon = stage.icon
  return (
    <article
      className={cn(
        'lift-card h-full rounded-xl border p-4',
        light ? 'border-white/12 bg-white/5' : 'border-gray-200 bg-white',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'icon-pop flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
            light ? 'bg-accent/20 text-white' : 'bg-accent-muted text-accent',
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-accent">
            {String(n).padStart(2, '0')}
          </p>
          <h3 className={cn('text-sm font-semibold', light ? 'text-white' : 'text-heading')}>
            {stage.label}
          </h3>
        </div>
      </div>
      <p className={cn('mt-3 text-sm leading-relaxed', light ? 'text-white/70' : 'text-muted')}>
        {stage.story}
      </p>
      <p
        className={cn(
          'mt-3 inline-flex rounded-md px-2.5 py-1 text-xs font-medium tabular-nums',
          light ? 'bg-white/10 text-white' : 'bg-body text-heading',
        )}
      >
        {stage.artifact}
      </p>
    </article>
  )
}
