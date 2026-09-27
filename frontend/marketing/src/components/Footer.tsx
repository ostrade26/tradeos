import { Link } from 'react-router-dom'
import { Logo } from './Logo'

const links = [
  { href: '#who', label: 'Solutions' },
  { href: '#product', label: 'Product' },
  { href: '#cycle', label: 'How it works' },
  { href: '#industries', label: 'Industries' },
  { href: '#faq', label: 'FAQ' },
  { href: '#demo', label: 'Get started' },
]

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-ink text-white/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 lg:flex-row lg:items-start lg:justify-between lg:px-8">
        <div>
          <Logo light />
          <p className="mt-3 max-w-sm text-sm text-white/55 leading-relaxed">
            Tradeal is a B2B trade operations platform. Bring commercial, operational, inventory,
            and outstanding amounts into one connected workflow.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm" aria-label="Footer">
          {links.map(link => (
            <a
              key={link.href}
              href={link.href}
              className="font-medium text-white/80 hover:text-white transition-colors duration-200 cursor-pointer"
            >
              {link.label}
            </a>
          ))}
          <Link
            to="/login"
            className="font-medium text-white hover:text-accent transition-colors duration-200 cursor-pointer"
          >
            Sign in
          </Link>
        </nav>
      </div>
      <div className="mx-auto max-w-6xl border-t border-white/10 px-4 py-5 sm:px-6 lg:px-8">
        <p className="text-sm text-white/45">{`© ${new Date().getFullYear()} Tradeal. All rights reserved.`}</p>
      </div>
    </footer>
  )
}
