import { Logo } from './Logo'

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-ink text-white/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div>
          <Logo light />
          <p className="mt-3 max-w-sm text-sm text-white/55">
            The operating desk for edible oil traders — purchase, sales, lifts, and lots in one register.
          </p>
        </div>
        <div className="text-sm">
          <a href="#demo" className="font-medium text-white hover:text-accent transition-colors duration-200 cursor-pointer">
            Request a demo
          </a>
          <p className="mt-2 text-white/45">© {new Date().getFullYear()} Tradeal</p>
        </div>
      </div>
    </footer>
  )
}
