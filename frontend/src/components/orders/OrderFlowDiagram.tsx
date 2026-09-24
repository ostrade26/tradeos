import { Link } from 'react-router-dom'
import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { FileText, Package, Send, Truck, Warehouse } from 'lucide-react'
import type { TradeOrder } from '../../data/mockData'
import { useTradeStore } from '../../store/TradeStore'
import { buildOrderFlowTree, type FlowNodeData, type FlowTree } from '../../lib/orderFlowGraph'
import { cn } from '../../lib/utils'

const kindStyles = {
  po: {
    icon: FileText,
    badge: 'bg-accent text-white',
    card: 'border-accent/25 shadow-[0_8px_24px_-12px_rgba(62,96,213,0.45)]',
  },
  so: {
    icon: Send,
    badge: 'bg-success text-white',
    card: 'border-success/20',
  },
  lift: {
    icon: Truck,
    badge: 'bg-violet-600 text-white dark:bg-violet-500',
    card: 'border-violet-200/80 dark:border-violet-900/40',
  },
  stock: {
    icon: Warehouse,
    badge: 'bg-gray-500 text-white dark:bg-gray-600',
    card: 'border-gray-200 dark:border-gray-700',
  },
} as const

const toneStyles = {
  success: 'bg-success-muted text-success',
  warning: 'bg-warning-muted text-warning',
  default: 'bg-gray-100 text-gray-600 dark:bg-gray-700/50 dark:text-gray-300',
  info: 'bg-info-muted text-info',
  accent: 'bg-accent-muted text-accent',
} as const

const flowCardClass = 'w-[18.5rem] min-h-[11rem] p-4 flex flex-col'

type Anchor = { x: number; y: number }

function SquareKindMark({
  className,
  children,
}: {
  className: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [side, setSide] = useState<number | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const sync = () => {
      const h = Math.round(el.getBoundingClientRect().height)
      if (h > 0) setSide(h)
    }
    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className="shrink-0 self-stretch"
      style={{ width: side ?? 40 }}
    >
      <div className={cn('flex h-full w-full items-center justify-center rounded-lg', className)}>
        {children}
      </div>
    </div>
  )
}

function FlowCard({
  node,
  nodeRef,
}: {
  node: FlowNodeData
  nodeRef?: (el: HTMLElement | null) => void
}) {
  const style = kindStyles[node.kind]
  const Icon = style.icon

  return (
    <div className="relative z-10 shrink-0">
      <Link
        ref={nodeRef}
        to={node.href}
        className={cn(
          'group rounded-xl border bg-white transition-all dark:bg-card',
          'hover:-translate-y-0.5 hover:shadow-md attex-focus',
          flowCardClass,
          style.card,
        )}
      >
        <div className="flex items-stretch gap-2.5 shrink-0">
          <SquareKindMark className={style.badge}>
            <Icon className="h-5 w-5" />
          </SquareKindMark>
          <div className="min-w-0 flex-1 flex flex-col justify-center">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted leading-4">
                {node.label}
              </p>
              <span className={cn('rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide shrink-0', toneStyles[node.statusTone])}>
                {node.statusLabel}
              </span>
            </div>
            <p className="text-base font-semibold text-heading leading-tight mt-0.5 group-hover:text-accent transition-colors">
              {node.ref}
            </p>
          </div>
        </div>
        <div className="min-h-0 flex-1 mt-3 space-y-1">
          <p className="text-xs text-heading leading-snug line-clamp-2">{node.party}</p>
          <p className="text-xs text-muted leading-snug line-clamp-2">{node.detail}</p>
        </div>
        <div className="mt-auto border-t border-gray-100 pt-2.5 dark:border-gray-800 flex items-center justify-between gap-2 shrink-0">
          <span className="text-[10px] uppercase tracking-wide text-muted">Qty</span>
          <span className="text-sm font-semibold tabular-nums text-heading">{node.qtyLabel}</span>
        </div>
      </Link>
    </div>
  )
}

const LINE_INSET = 0
const LINE_CORNER = 8
const LINE_STROKE = 1.15
/** Treat stacked cards as a straight drop if their centers are this close. */
const ALIGNED_X = LINE_CORNER

function anchor(el: HTMLElement, container: DOMRect, edge: 'top' | 'bottom'): Anchor {
  const rect = el.getBoundingClientRect()
  return {
    x: rect.left + rect.width / 2 - container.left,
    y: edge === 'bottom' ? rect.bottom - container.top : rect.top - container.top,
  }
}

function insetAnchor(el: HTMLElement, container: DOMRect, edge: 'top' | 'bottom'): Anchor {
  const point = anchor(el, container, edge)
  return {
    x: point.x,
    y: edge === 'bottom' ? point.y + LINE_INSET : point.y - LINE_INSET,
  }
}

function roundedPolyline(points: Anchor[], radius = LINE_CORNER): string {
  const pts = points.filter((p, i) => {
    if (i === 0) return true
    const prev = points[i - 1]!
    return Math.hypot(p.x - prev.x, p.y - prev.y) > 0.5
  })
  if (pts.length < 2) return ''
  if (pts.length === 2) {
    return `M ${pts[0]!.x} ${pts[0]!.y} L ${pts[1]!.x} ${pts[1]!.y}`
  }

  let d = `M ${pts[0]!.x} ${pts[0]!.y}`
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1]!
    const curr = pts[i]!
    const next = pts[i + 1]!
    const inX = curr.x - prev.x
    const inY = curr.y - prev.y
    const outX = next.x - curr.x
    const outY = next.y - curr.y
    const inLen = Math.hypot(inX, inY)
    const outLen = Math.hypot(outX, outY)
    const r = Math.min(radius, inLen / 2, outLen / 2)
    if (r < 1) {
      d += ` L ${curr.x} ${curr.y}`
      continue
    }
    d += ` L ${curr.x - (inX / inLen) * r} ${curr.y - (inY / inLen) * r}`
    d += ` Q ${curr.x} ${curr.y} ${curr.x + (outX / outLen) * r} ${curr.y + (outY / outLen) * r}`
  }
  const last = pts[pts.length - 1]!
  d += ` L ${last.x} ${last.y}`
  return d
}

function connectPair(from: Anchor, to: Anchor): string {
  if (to.y <= from.y + 2) {
    return `M ${from.x} ${from.y} L ${to.x} ${to.y}`
  }
  if (Math.abs(from.x - to.x) < ALIGNED_X) {
    return `M ${from.x} ${from.y} L ${from.x} ${to.y}`
  }
  const busY = from.y + (to.y - from.y) / 2
  return roundedPolyline([
    from,
    { x: from.x, y: busY },
    { x: to.x, y: busY },
    to,
  ])
}

function connectFan(parent: Anchor, children: Anchor[]): string {
  if (children.length === 0) return ''
  if (children.length === 1) return connectPair(parent, children[0]!)

  const minChildY = Math.min(...children.map(c => c.y))
  const span = minChildY - parent.y
  if (span < 8) {
    return children.map(child => connectPair(parent, child)).join(' ')
  }
  const busY = parent.y + span / 2
  return children.map(child => {
    if (Math.abs(child.x - parent.x) < ALIGNED_X) {
      return `M ${parent.x} ${parent.y} L ${parent.x} ${child.y}`
    }
    return roundedPolyline([
      parent,
      { x: parent.x, y: busY },
      { x: child.x, y: busY },
      child,
    ])
  }).join(' ')
}

function collectEdges(
  tree: FlowTree,
  refs: Map<string, HTMLElement>,
  container: DOMRect,
): string[] {
  const paths: string[] = []
  const parentEl = refs.get(tree.node.id)
  if (!parentEl) return paths

  const soBranches = tree.children
  if (soBranches.length === 0) return paths

  const soEls = soBranches
    .map(branch => refs.get(branch.node.id))
    .filter((el): el is HTMLElement => !!el)

  if (soEls.length > 0) {
    paths.push(connectFan(
      insetAnchor(parentEl, container, 'bottom'),
      soEls.map(el => insetAnchor(el, container, 'top')),
    ))
  }

  for (const branch of soBranches) {
    const chain = [
      refs.get(branch.node.id),
      ...branch.children.map(lift => refs.get(lift.node.id)),
    ].filter((el): el is HTMLElement => !!el)

    for (let i = 0; i < chain.length - 1; i++) {
      paths.push(connectPair(
        insetAnchor(chain[i]!, container, 'bottom'),
        insetAnchor(chain[i + 1]!, container, 'top'),
      ))
    }
  }

  return paths.filter(Boolean)
}

function SoColumn({
  branch,
  registerRef,
}: {
  branch: FlowTree
  registerRef: (id: string, el: HTMLElement | null) => void
}) {
  return (
    <div className="flex flex-col items-center w-[18.5rem] gap-7">
      <FlowCard node={branch.node} nodeRef={el => registerRef(branch.node.id, el)} />
      {branch.children.map(liftBranch => (
        <FlowCard
          key={liftBranch.node.id}
          node={liftBranch.node}
          nodeRef={el => registerRef(liftBranch.node.id, el)}
        />
      ))}
    </div>
  )
}

function PoCentricFlow({
  tree,
  registerRef,
}: {
  tree: FlowTree
  registerRef: (id: string, el: HTMLElement | null) => void
}) {
  const branches = tree.children

  return (
    <div className="flex flex-col items-center gap-14">
      <FlowCard node={tree.node} nodeRef={el => registerRef(tree.node.id, el)} />
      {branches.length > 0 && (
        <div className="inline-flex items-start justify-center gap-8 px-4">
          {branches.map(branch => (
            <SoColumn key={branch.node.id} branch={branch} registerRef={registerRef} />
          ))}
        </div>
      )}
    </div>
  )
}

function EmptyFlowHint({ order, rootPoRef }: { order: TradeOrder; rootPoRef?: string }) {
  const isPO = order.side === 'purchase'
  const poRef = isPO ? order.ref : rootPoRef
  const soRef = isPO ? undefined : order.ref
  const liftQuery = [
    poRef ? `poRef=${encodeURIComponent(poRef)}` : '',
    soRef ? `soRef=${encodeURIComponent(soRef)}` : '',
  ].filter(Boolean).join('&')
  const liftHref = liftQuery ? `/lifts/new?${liftQuery}` : '/lifts/new'
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <div className="flex items-center gap-3 text-muted">
        <Package className="h-5 w-5 shrink-0" />
        <span className="text-sm">→</span>
        <Send className="h-5 w-5 shrink-0" />
        <span className="text-sm">→</span>
        <Truck className="h-5 w-5 shrink-0" />
      </div>
      <p className="text-sm text-muted max-w-sm">
        {isPO
          ? 'Link sales orders and record lifts to see the full PO → SO → Lift chain here.'
          : `All SOs and lifts linked to ${rootPoRef ?? 'this PO'} will appear in one view.`}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {(isPO || rootPoRef) && (
          <Link
            to={`/sales-orders/new?poRef=${encodeURIComponent(isPO ? order.ref : rootPoRef!)}`}
            className="text-sm font-medium text-accent hover:underline"
          >
            Create SO
          </Link>
        )}
        <Link to={liftHref} className="text-sm font-medium text-accent hover:underline">
          Record lift
        </Link>
      </div>
    </div>
  )
}

function FlowCanvas({
  order,
  tree,
  hasChain,
  rootPoRef,
}: {
  order: TradeOrder
  tree: FlowTree
  hasChain: boolean
  rootPoRef?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const nodeRefs = useRef<Map<string, HTMLElement>>(new Map())
  const [paths, setPaths] = useState<string[]>([])

  const registerRef = useCallback((id: string, el: HTMLElement | null) => {
    if (el) nodeRefs.current.set(id, el)
    else nodeRefs.current.delete(id)
  }, [])

  const updatePaths = useCallback(() => {
    const container = containerRef.current
    if (!container || !hasChain) {
      setPaths([])
      return
    }
    const origin = container.getBoundingClientRect()
    setPaths(collectEdges(tree, nodeRefs.current, origin))
  }, [tree, hasChain])

  useLayoutEffect(() => {
    updatePaths()
    const frame = requestAnimationFrame(updatePaths)
    const container = containerRef.current
    if (!container) return () => cancelAnimationFrame(frame)

    const observer = new ResizeObserver(() => updatePaths())
    observer.observe(container)
    window.addEventListener('resize', updatePaths)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', updatePaths)
    }
  }, [updatePaths])

  return (
    <div ref={containerRef} className="relative min-w-min px-6 py-10 flex justify-center">
      {hasChain && paths.length > 0 && (
        <svg
          className="absolute inset-0 w-full h-full overflow-visible pointer-events-none text-gray-300 dark:text-gray-600"
          aria-hidden
        >
          {paths.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke="currentColor"
              strokeWidth={LINE_STROKE}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </svg>
      )}
      {hasChain ? (
        <PoCentricFlow tree={tree} registerRef={registerRef} />
      ) : (
        <div className="relative z-10 flex flex-col items-center gap-6">
          <FlowCard node={tree.node} nodeRef={el => registerRef(tree.node.id, el)} />
          <EmptyFlowHint order={order} rootPoRef={rootPoRef} />
        </div>
      )}
    </div>
  )
}

export function OrderFlowDiagram({ order, className }: { order: TradeOrder; className?: string }) {
  const store = useTradeStore()
  const tree = buildOrderFlowTree(store, order)
  const hasChain = tree.children.length > 0
  const rootPoRef = order.side === 'purchase' ? order.ref : order.poRef

  return (
    <div
      className={cn(
        'relative flex flex-col overflow-hidden rounded-lg border border-gray-200/80 bg-[#f8f9fc] dark:border-gray-700/50 dark:bg-gray-900/30',
        className,
      )}
      style={{
        backgroundImage: 'radial-gradient(circle, rgb(148 163 184 / 0.35) 1px, transparent 1px)',
        backgroundSize: '20px 20px',
      }}
    >
      <div className="min-h-0 flex-1 overflow-auto">
        <FlowCanvas order={order} tree={tree} hasChain={hasChain} rootPoRef={rootPoRef} />
      </div>
    </div>
  )
}
