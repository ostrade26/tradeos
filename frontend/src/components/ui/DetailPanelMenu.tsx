import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { MoreHorizontal, type LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

/** Above docked column (z-1000) and undocked detail drawer (z-1200 in Drawer.tsx). */
const MENU_Z_INDEX = 1250

export type DetailPanelMenuItem =
  | {
      type: 'separator'
    }
  | {
      type: 'link' | 'button'
      label: string
      icon: LucideIcon
      href?: string
      onClick?: () => void
      tone?: 'default' | 'whatsapp' | 'danger' | 'muted'
    }

interface DetailPanelMenuProps {
  items: DetailPanelMenuItem[]
  /** Called when a link item is chosen (e.g. close the panel before navigation). Not invoked for buttons. */
  onItemSelect?: () => void
  align?: 'start' | 'end'
  /** Table rows — short trigger sized to match table density (not the 44px panel default). */
  tableTrigger?: string
}

const itemToneClass: Record<NonNullable<Extract<DetailPanelMenuItem, { type: 'link' | 'button' }>['tone']>, string> = {
  default: 'text-heading hover:bg-gray-50 dark:hover:bg-gray-800/60',
  whatsapp: 'text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30',
  danger: 'text-danger hover:bg-red-50 dark:hover:bg-red-950/30',
  muted: 'text-muted hover:bg-gray-50 dark:hover:bg-gray-800/60',
}

export function groupMenuItems(groups: { items: DetailPanelMenuItem[] }[]): DetailPanelMenuItem[] {
  const out: DetailPanelMenuItem[] = []
  for (const group of groups) {
    const entries = group.items.filter(item => item.type !== 'separator')
    if (entries.length === 0) continue
    if (out.length > 0) out.push({ type: 'separator' })
    out.push(...entries)
  }
  return out
}

function estimateMenuHeight(items: DetailPanelMenuItem[]) {
  return items.reduce((height, item) => {
    if (item.type === 'separator') return height + 5
    return height + 30
  }, 4)
}

function computeMenuPosition(
  btn: HTMLButtonElement,
  align: 'start' | 'end',
  items: DetailPanelMenuItem[],
): { top: number; left: number } {
  const rect = btn.getBoundingClientRect()
  const menuWidth = 200
  const menuHeight = estimateMenuHeight(items)
  const gap = 4

  let top = rect.bottom + gap
  let left = align === 'end' ? rect.right - menuWidth : rect.left

  if (top + menuHeight > window.innerHeight - 8) {
    top = rect.top - menuHeight - gap
  }
  left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8))
  top = Math.max(8, top)

  return { top, left }
}

export function DetailPanelMenu({ items, onItemSelect, align = 'end', tableTrigger }: DetailPanelMenuProps) {
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const syncMenuPosition = useCallback(() => {
    const btn = buttonRef.current
    if (!btn) return
    setMenuStyle(computeMenuPosition(btn, align, items))
  }, [align, items])

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(null)
      return
    }
    syncMenuPosition()
  }, [open, syncMenuPosition])

  useEffect(() => {
    if (!open) return
    const onScrollOrResize = () => syncMenuPosition()
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [open, syncMenuPosition])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: globalThis.MouseEvent) => {
      const target = e.target as Node
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const timer = window.setTimeout(() => {
      // Capture phase: Modal/Drawer stopPropagation on bubble, which would skip document listeners.
      document.addEventListener('mousedown', onPointerDown, true)
    }, 0)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('mousedown', onPointerDown, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const getItems = () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
    const focusFirst = window.requestAnimationFrame(() => getItems()[0]?.focus())
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
        buttonRef.current?.focus()
        return
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      const list = getItems()
      if (list.length === 0) return
      e.preventDefault()
      const idx = list.findIndex(el => el === document.activeElement)
      const next = e.key === 'ArrowDown'
        ? (idx + 1) % list.length
        : (idx <= 0 ? list.length - 1 : idx - 1)
      list[next]?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      window.cancelAnimationFrame(focusFirst)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const closeAndRun = (action?: () => void, dismissPanel = false) => {
    setOpen(false)
    action?.()
    if (dismissPanel) onItemSelect?.()
  }

  const handleToggle = (e: ReactMouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    setOpen(v => {
      if (v) return false
      const btn = buttonRef.current
      if (btn) {
        setMenuStyle(computeMenuPosition(btn, align, items))
      }
      return true
    })
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        title="More actions"
        aria-label="More actions"
        aria-expanded={open}
        aria-haspopup="menu"
        onMouseDown={e => e.stopPropagation()}
        onClick={handleToggle}
        className={cn(
          'inline-flex items-center justify-center rounded-lg text-muted hover:bg-gray-100 hover:text-heading dark:hover:bg-zinc-800 cursor-pointer attex-focus',
          tableTrigger ?? 'min-h-11 min-w-11',
        )}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && menuStyle && createPortal(
        <div
          ref={menuRef}
          role="menu"
          data-overlay-dismiss="ignore"
          style={{ position: 'fixed', top: menuStyle.top, left: menuStyle.left, zIndex: MENU_Z_INDEX }}
          className="min-w-[12.5rem] rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-card shadow-lg py-0.5"
          onMouseDown={e => e.stopPropagation()}
        >
          {items.map((item, index) => {
            if (item.type === 'separator') {
              return (
                <div
                  key={`sep-${index}`}
                  role="separator"
                  className="my-0.5 border-t border-gray-200 dark:border-gray-700"
                />
              )
            }

            const Icon = item.icon
            const className = cn(
              'flex w-full min-h-8 items-center gap-2 px-3 py-1.5 text-sm cursor-pointer',
              itemToneClass[item.tone ?? 'default'],
            )

            if (item.type === 'link' && item.href) {
              return (
                <Link
                  key={item.label}
                  to={item.href}
                  role="menuitem"
                  onClick={() => closeAndRun(item.onClick, true)}
                  className={className}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {item.label}
                </Link>
              )
            }

            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={() => closeAndRun(item.onClick, false)}
                className={className}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {item.label}
              </button>
            )
          })}
        </div>,
        document.body,
      )}
    </>
  )
}
