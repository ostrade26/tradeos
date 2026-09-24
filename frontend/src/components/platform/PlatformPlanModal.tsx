import { useEffect, useState } from 'react'
import { Modal } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Badge } from '../ui/Badge'
import { cn } from '../../lib/utils'
import type { SubscriptionPlan } from '../../api/platformApi'

export type PlanFormPayload = Omit<SubscriptionPlan, 'id' | 'created_at' | 'updated_at'>

function rupeesFromCents(cents: number | undefined): string {
  if (cents == null || Number.isNaN(cents)) return ''
  return String(cents / 100)
}

function centsFromRupees(value: string): number {
  const n = Number(value.replace(/,/g, '').trim())
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100)
}

function formatRupees(raw: string): string {
  const n = Number(raw.replace(/,/g, '').trim())
  if (!raw.trim() || !Number.isFinite(n) || n < 0) return ''
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

function emptyForm(): PlanFormPayload {
  return {
    slug: '',
    name: '',
    description: '',
    monthly_price_cents: 0,
    annual_price_cents: 0,
    additional_seat_monthly_price_cents: 0,
    additional_seat_annual_price_cents: 0,
    included_seats: 2,
    licence_type: 'perpetual',
    licence_price_cents: 0,
    included_admin_seats: 1,
    included_operator_seats: 1,
    additional_seat_licence_cents: 0,
    amc_price_cents: 0,
    additional_seat_amc_cents: 0,
    amc_duration_months: 12,
    amc_grace_days: 30,
    status: 'active',
  }
}

function formFromPlan(plan: SubscriptionPlan): PlanFormPayload {
  return {
    slug: plan.slug,
    name: plan.name,
    description: plan.description ?? '',
    monthly_price_cents: plan.monthly_price_cents ?? 0,
    annual_price_cents: plan.annual_price_cents ?? 0,
    additional_seat_monthly_price_cents: plan.additional_seat_monthly_price_cents ?? 0,
    additional_seat_annual_price_cents: plan.additional_seat_annual_price_cents ?? 0,
    included_seats: plan.included_seats,
    licence_type: plan.licence_type ?? 'perpetual',
    licence_price_cents: plan.licence_price_cents ?? 0,
    included_admin_seats: plan.included_admin_seats ?? 1,
    included_operator_seats: plan.included_operator_seats ?? 1,
    additional_seat_licence_cents: plan.additional_seat_licence_cents ?? 0,
    amc_price_cents: plan.amc_price_cents ?? 0,
    additional_seat_amc_cents: plan.additional_seat_amc_cents ?? 0,
    amc_duration_months: plan.amc_duration_months ?? 12,
    amc_grace_days: plan.amc_grace_days ?? 30,
    status: plan.status,
  }
}

function PreviewLine({
  label,
  value,
}: {
  label: string
  value: string
}) {
  const show = Boolean(value.trim())
  return (
    <div
      className={cn(
        'grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none',
        show ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
      )}
    >
      <div className="min-h-0 overflow-hidden">
        <div className="flex items-baseline justify-between gap-3 py-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
          <p className="text-sm font-semibold tabular-nums text-heading text-right">{value}</p>
        </div>
      </div>
    </div>
  )
}

function PlanPreview({
  form,
  licenceRupees,
  amcRupees,
  seatLicenceRupees,
  seatAmcRupees,
}: {
  form: PlanFormPayload
  licenceRupees: string
  amcRupees: string
  seatLicenceRupees: string
  seatAmcRupees: string
}) {
  const name = form.name.trim()
  const slug = form.slug.trim().toLowerCase()
  const description = form.description.trim()
  const licence = formatRupees(licenceRupees)
  const amc = formatRupees(amcRupees)
  const extraLicence = formatRupees(seatLicenceRupees)
  const extraAmc = formatRupees(seatAmcRupees)
  const hasAny = Boolean(name || slug || description || licence || amc)

  return (
    <div aria-live="polite">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Preview</p>
      <div
        className={cn(
          'mt-3 transition-opacity duration-300 motion-reduce:transition-none',
          hasAny ? 'opacity-100' : 'opacity-60',
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={cn('text-lg font-semibold tracking-tight', name ? 'text-heading' : 'text-muted')}>
              {name || 'Plan name'}
            </p>
            <p className={cn('text-xs mt-0.5', slug ? 'text-muted' : 'text-muted/70')}>
              {slug || 'slug'}
            </p>
          </div>
          <Badge variant={form.status === 'active' ? 'success' : 'default'} className="capitalize">
            {form.status}
          </Badge>
        </div>
        <div
          className={cn(
            'grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none',
            licence ? 'grid-rows-[1fr] opacity-100 mt-4' : 'grid-rows-[0fr] opacity-0',
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <p className="text-3xl font-semibold tabular-nums tracking-tight text-heading">
              {licence || '—'}
            </p>
            <p className="text-xs font-medium uppercase tracking-wide text-muted mt-1">One-time licence</p>
          </div>
        </div>
        <p
          className={cn(
            'text-sm leading-relaxed break-words mt-3 transition-opacity duration-300',
            description ? 'text-muted opacity-100' : 'opacity-0 h-0 mt-0 overflow-hidden',
          )}
        >
          {description}
        </p>
        <div className="mt-4 divide-y divide-gray-200/80 dark:divide-gray-700/80">
          <PreviewLine
            label="AMC"
            value={amc ? `${amc} / ${form.amc_duration_months || 12} mo` : ''}
          />
          <PreviewLine
            label="Seats"
            value={`${(form.included_admin_seats ?? 0) + (form.included_operator_seats ?? 0)} total · ${form.included_admin_seats ?? 0} admin · ${form.included_operator_seats ?? 0} operator`}
          />
          <PreviewLine label="Extra seat licence" value={extraLicence} />
          <PreviewLine
            label="Extra seat AMC"
            value={extraAmc ? `${extraAmc} / year` : ''}
          />
          <PreviewLine
            label="Grace"
            value={form.amc_grace_days != null ? `${form.amc_grace_days} days` : ''}
          />
          <PreviewLine
            label="Type"
            value={form.licence_type === 'term' ? 'Term' : 'Perpetual'}
          />
        </div>
      </div>
    </div>
  )
}

export function PlatformPlanModal({
  open,
  onClose,
  plan,
  loading,
  deleting = false,
  onSubmit,
  onDelete,
}: {
  open: boolean
  onClose: () => void
  plan: SubscriptionPlan | null
  loading: boolean
  deleting?: boolean
  onSubmit: (payload: PlanFormPayload) => void
  onDelete?: () => void
}) {
  const [form, setForm] = useState<PlanFormPayload>(emptyForm())
  const [licenceRupees, setLicenceRupees] = useState('')
  const [amcRupees, setAmcRupees] = useState('')
  const [seatLicenceRupees, setSeatLicenceRupees] = useState('')
  const [seatAmcRupees, setSeatAmcRupees] = useState('')

  useEffect(() => {
    if (!open) return
    const next = plan ? formFromPlan(plan) : emptyForm()
    setForm(next)
    setLicenceRupees(rupeesFromCents(next.licence_price_cents))
    setAmcRupees(rupeesFromCents(next.amc_price_cents))
    setSeatLicenceRupees(rupeesFromCents(next.additional_seat_licence_cents))
    setSeatAmcRupees(rupeesFromCents(next.additional_seat_amc_cents))
  }, [open, plan])

  const slugLocked = Boolean(plan)
  const canDelete = Boolean(plan && plan.status === 'inactive' && onDelete)
  const busy = loading || deleting

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={plan ? 'Edit plan' : 'New plan'}
      subtitle="Prices apply to new licences. Existing licences keep recorded amounts."
      size="xl"
      bodyClassName="split-pane !p-0 min-h-0 flex-1 overflow-hidden"
      footerClassName="w-full items-center justify-between gap-3"
      footer={
        <>
          {canDelete ? (
            <Button
              variant="outline"
              className="text-danger border-danger/30 hover:bg-danger/5"
              disabled={busy}
              onClick={onDelete}
            >
              Delete plan
            </Button>
          ) : (
            <span />
          )}
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              loading={loading}
              onClick={() =>
                onSubmit({
                  ...form,
                  slug: form.slug.trim().toLowerCase(),
                  name: form.name.trim(),
                  licence_price_cents: centsFromRupees(licenceRupees),
                  amc_price_cents: centsFromRupees(amcRupees),
                  additional_seat_licence_cents: centsFromRupees(seatLicenceRupees),
                  additional_seat_amc_cents: centsFromRupees(seatAmcRupees),
                  additional_seat_annual_price_cents: centsFromRupees(seatAmcRupees),
                  included_seats: Math.max(
                    1,
                    (form.included_admin_seats ?? 0) + (form.included_operator_seats ?? 0),
                  ),
                })
              }
              disabled={busy || !form.slug.trim() || !form.name.trim()}
            >
              Save plan
            </Button>
          </div>
        </>
      }
    >
      <div className="grid min-h-0 h-[min(36rem,calc(90dvh-12rem))] lg:grid-cols-[minmax(0,1.15fr)_minmax(17rem,0.85fr)]">
        <div className="min-h-0 overflow-y-auto px-6 py-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Plan name"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
            <Input
              label="Slug"
              value={form.slug}
              readOnly={slugLocked}
              onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
            />
            <label className="flex flex-col gap-2.5 sm:col-span-2">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Description</span>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
                className="min-h-[4.75rem] w-full resize-y rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-card px-3 py-2 text-sm text-heading leading-relaxed focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
              />
            </label>
            <Select
              searchable={false}
              label="Licence type"
              value={form.licence_type ?? 'perpetual'}
              onChange={e => setForm(f => ({ ...f, licence_type: e.target.value }))}
              options={[
                { value: 'perpetual', label: 'Perpetual' },
                { value: 'term', label: 'Term' },
              ]}
            />
            <Select
              searchable={false}
              label="Status"
              value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
            />
            <Input
              label="One-time licence (₹)"
              inputMode="decimal"
              value={licenceRupees}
              onChange={e => setLicenceRupees(e.target.value)}
            />
            <Input
              label="AMC (₹ / year)"
              inputMode="decimal"
              value={amcRupees}
              onChange={e => setAmcRupees(e.target.value)}
            />
            <Input
              label="Included Admin seats"
              inputMode="numeric"
              value={String(form.included_admin_seats ?? 0)}
              onChange={e => setForm(f => ({ ...f, included_admin_seats: Math.max(0, Number(e.target.value) || 0) }))}
            />
            <Input
              label="Included Operator seats"
              inputMode="numeric"
              value={String(form.included_operator_seats ?? 0)}
              onChange={e => setForm(f => ({ ...f, included_operator_seats: Math.max(0, Number(e.target.value) || 0) }))}
            />
            <Input
              label="Additional seat licence (₹)"
              inputMode="decimal"
              value={seatLicenceRupees}
              onChange={e => setSeatLicenceRupees(e.target.value)}
            />
            <Input
              label="Additional seat AMC (₹ / year)"
              inputMode="decimal"
              value={seatAmcRupees}
              onChange={e => setSeatAmcRupees(e.target.value)}
            />
            <Input
              label="AMC duration (months)"
              inputMode="numeric"
              value={String(form.amc_duration_months ?? 12)}
              onChange={e => setForm(f => ({ ...f, amc_duration_months: Math.max(1, Number(e.target.value) || 1) }))}
            />
            <Input
              label="AMC grace period (days)"
              inputMode="numeric"
              value={String(form.amc_grace_days ?? 30)}
              onChange={e => setForm(f => ({ ...f, amc_grace_days: Math.max(0, Number(e.target.value) || 0) }))}
            />
          </div>
        </div>
        <div className="border-t lg:border-t-0 lg:border-l border-gray-200 bg-gray-50/90 dark:border-gray-700 dark:bg-gray-800/50 px-6 py-6 overflow-y-auto">
          <PlanPreview
            form={form}
            licenceRupees={licenceRupees}
            amcRupees={amcRupees}
            seatLicenceRupees={seatLicenceRupees}
            seatAmcRupees={seatAmcRupees}
          />
        </div>
      </div>
    </Modal>
  )
}
