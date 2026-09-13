import { CheckCircle2, Loader2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { cn } from '../lib/utils'

type FieldErrors = Partial<Record<'name' | 'company' | 'contact' | 'form', string>>

const empty = {
  name: '',
  company: '',
  phone: '',
  email: '',
  message: '',
}

function validate(values: typeof empty): FieldErrors {
  const errors: FieldErrors = {}
  if (!values.name.trim()) errors.name = 'Name is required'
  if (!values.company.trim()) errors.company = 'Company is required'
  if (!values.phone.trim() && !values.email.trim()) {
    errors.contact = 'Add a phone number or email so we can reach you'
  } else if (values.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.contact = 'Enter a valid email address'
  }
  return errors
}

export function DemoForm() {
  const [values, setValues] = useState(empty)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const next = validate(values)
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setLoading(true)
    try {
      const res = await fetch('/api/v1/demo-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name.trim(),
          company: values.company.trim(),
          phone: values.phone.trim(),
          email: values.email.trim(),
          message: values.message.trim(),
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { detail?: unknown } | null
        const detail = body?.detail
        throw new Error(typeof detail === 'string' ? detail : 'Could not send the request. Try again in a moment.')
      }
      setDone(true)
    } catch (err) {
      const network = err instanceof TypeError
      setErrors({
        form: network
          ? 'Could not reach the API. Start it with npm run dev:backend, then try again.'
          : err instanceof Error ? err.message : 'Could not send the request. Try again in a moment.',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <section id="demo" className="relative overflow-hidden bg-ink text-white">
      <img
        src="/images/trading-desk.jpg"
        alt=""
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover opacity-30"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/90 to-ink/75" />
      <div className="film-grain" />

      <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 sm:py-24 lg:grid-cols-2 lg:px-8 lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">Request a demo</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            See the desk with your book.
          </h2>
          <p className="mt-4 text-white/70 leading-relaxed">
            Tell us how you buy, sell, and lift today. We’ll walk through purchase orders, tanker
            splits, and remaining-to-lift on a working TradeOS desk.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-white/75">
            <li className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              30-minute walkthrough of POs, SOs, and lifts
            </li>
            <li className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Mapped to edible oil workflow — not a generic CRM tour
            </li>
            <li className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              No account required to start the conversation
            </li>
          </ul>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white p-6 text-heading shadow-[0_24px_60px_rgba(0,0,0,0.35)] sm:p-8">
          {done ? (
            <div className="flex flex-col items-start py-6">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-success-muted text-success">
                <CheckCircle2 className="h-6 w-6" aria-hidden />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-heading">Request received</h3>
              <p className="mt-2 text-sm text-muted leading-relaxed">
                Thanks — we’ll be in touch shortly to schedule a demo of TradeOS on your trades.
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate className="space-y-4">
              <Field
                id="demo-name"
                label="Name"
                value={values.name}
                error={errors.name}
                autoComplete="name"
                onChange={name => setValues(v => ({ ...v, name }))}
              />
              <Field
                id="demo-company"
                label="Company"
                value={values.company}
                error={errors.company}
                autoComplete="organization"
                onChange={company => setValues(v => ({ ...v, company }))}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  id="demo-phone"
                  label="Phone"
                  type="tel"
                  value={values.phone}
                  autoComplete="tel"
                  onChange={phone => setValues(v => ({ ...v, phone }))}
                />
                <Field
                  id="demo-email"
                  label="Email"
                  type="email"
                  value={values.email}
                  autoComplete="email"
                  onChange={email => setValues(v => ({ ...v, email }))}
                />
              </div>
              {errors.contact && (
                <p id="demo-contact-error" className="text-xs text-danger">{errors.contact}</p>
              )}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="demo-message" className="text-sm font-medium text-heading">
                  What should we cover? <span className="font-normal text-muted">(optional)</span>
                </label>
                <textarea
                  id="demo-message"
                  rows={4}
                  value={values.message}
                  onChange={e => setValues(v => ({ ...v, message: e.target.value }))}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-base text-heading placeholder:text-muted/80 transition-colors duration-150 focus:outline-none focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent/30"
                  placeholder="e.g. tanker splits, PDF import, Kolhapur spots…"
                />
              </div>
              {errors.form && (
                <p className="text-xs text-danger" role="alert">{errors.form}</p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="btn-glow inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-accent px-5 text-sm font-semibold text-white hover:bg-accent-hover hover:-translate-y-0.5 cursor-pointer disabled:opacity-50 disabled:pointer-events-none disabled:hover:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                {loading ? 'Sending…' : 'Request a demo'}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  type = 'text',
  autoComplete,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  type?: string
  autoComplete?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-heading">{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={e => onChange(e.target.value)}
        className={cn(
          'h-11 w-full rounded-md border bg-white px-3 text-base text-heading placeholder:text-muted/80 transition-colors duration-150',
          'focus:outline-none focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent/30',
          error ? 'border-danger' : 'border-gray-200',
        )}
      />
      {error && <span id={`${id}-error`} className="text-xs text-danger">{error}</span>}
    </div>
  )
}
