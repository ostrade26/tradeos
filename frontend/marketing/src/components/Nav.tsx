import { Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '../lib/utils'
import { Logo } from './Logo'

const links = [
  { href: '#product', label: 'Product' },
  { href: '#how-it-works', label: 'How it works' },
]

export function Nav() {
  const [open, setOpen] = useState(false)
  const [solid, setSolid] = useState(false)

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const light = !solid

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,box-shadow] duration-300',
        solid
          ? 'border-b border-gray-200/80 bg-white/90 shadow-sm backdrop-blur-md'
          : 'border-b border-transparent bg-gradient-to-b from-ink/70 to-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Logo light={light} />

        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          {links.map(link => (
            <a
              key={link.href}
              href={link.href}
              className={cn(
                'text-sm font-medium transition-colors duration-200 cursor-pointer',
                light ? 'text-white/80 hover:text-white' : 'text-muted hover:text-heading',
              )}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href="#demo"
            className="btn-glow inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Request a demo
          </a>
          <button
            type="button"
            className={cn(
              'inline-flex h-11 w-11 items-center justify-center rounded-md md:hidden cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              light ? 'text-white hover:bg-white/10' : 'text-heading hover:bg-gray-100',
            )}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen(v => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="mobile-nav"
          className={cn(
            'border-t px-4 py-3 md:hidden sm:px-6',
            solid ? 'border-gray-200 bg-white' : 'border-white/10 bg-ink/95 backdrop-blur-md',
          )}
          aria-label="Mobile"
        >
          {links.map(link => (
            <a
              key={link.href}
              href={link.href}
              className={cn(
                'block rounded-md px-3 py-3 text-sm font-medium cursor-pointer',
                solid ? 'text-heading hover:bg-gray-50' : 'text-white hover:bg-white/10',
              )}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  )
}
