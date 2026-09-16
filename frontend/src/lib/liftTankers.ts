import type { Lift, LiftTanker } from '../data/mockData'
import { roundQtyMt } from './utils'

export { roundQtyMt }

/** Typical tanker capacity (MT) — one tanker holds ~50–60 MT. */
export const TANKER_CAPACITY_MT = 55

export type LiftTankerFormValues = {
  tankerNo: string
  transportName: string
  driverMobile: string
  lrNo: string
  actualQty: string
  salesInvoiceNo: string
}

export function emptyLiftTankerForm(): LiftTankerFormValues {
  return { tankerNo: '', transportName: '', driverMobile: '', lrNo: '', actualQty: '', salesInvoiceNo: '' }
}

export function emptyLiftTanker(): LiftTanker {
  return { tankerNo: '', transportName: '', driverMobile: '', lrNo: '' }
}

/** Live mask for Indian tanker plates: MH-12-RF-4236 */
export function formatTankerNo(raw: string): string {
  let rest = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')

  const take = (pattern: RegExp, max: number) => {
    const chunk = (rest.match(pattern)?.[0] ?? '').slice(0, max)
    rest = rest.slice(chunk.length)
    return chunk
  }

  const state = take(/^[A-Z]+/, 2)
  const rto = take(/^\d+/, 2)
  const series = take(/^[A-Z]+/, 2)
  const number = take(/^\d+/, 4)
  const parts = [state, rto, series, number].filter(Boolean)
  return parts.join('-')
}

export function liftTankerToForm(t: LiftTanker): LiftTankerFormValues {
  return {
    tankerNo: formatTankerNo(t.tankerNo),
    transportName: t.transportName,
    driverMobile: t.driverMobile,
    lrNo: t.lrNo ?? '',
    actualQty: t.actualQtyMt != null ? String(t.actualQtyMt) : '',
    salesInvoiceNo: t.salesInvoiceNo ?? '',
  }
}

export function formToLiftTanker(f: LiftTankerFormValues): LiftTanker {
  const qty = parseFloat(f.actualQty)
  const invoice = f.salesInvoiceNo.trim()
  return {
    tankerNo: formatTankerNo(f.tankerNo),
    transportName: f.transportName.trim(),
    driverMobile: f.driverMobile.trim(),
    lrNo: f.lrNo.trim().toUpperCase(),
    actualQtyMt: qty > 0 ? roundQtyMt(qty) : undefined,
    ...(invoice ? { salesInvoiceNo: invoice } : {}),
  }
}

export function totalActualQtyFromForm(tankers: LiftTankerFormValues[]): number {
  return roundQtyMt(tankers.reduce((sum, t) => sum + (parseFloat(t.actualQty) || 0), 0))
}

export function totalActualQtyFromTankers(tankers: LiftTanker[]): number {
  return roundQtyMt(tankers.reduce((sum, t) => sum + (t.actualQtyMt ?? 0), 0))
}

export function resolveLiftQty(tankers: LiftTanker[]): number {
  return totalActualQtyFromTankers(tankers)
}

export function suggestedTankerCount(qtyMt: number): number {
  if (!qtyMt || qtyMt <= 0) return 1
  return Math.max(1, Math.ceil(qtyMt / TANKER_CAPACITY_MT))
}

export function getLiftTankers(lift: Pick<Lift, 'tankers' | 'tankerNo'> & { liftedQty?: number }): LiftTanker[] {
  if (lift.tankers?.length) {
    return lift.tankers.map(t => ({
      ...t,
      tankerNo: formatTankerNo(t.tankerNo),
      actualQtyMt: t.actualQtyMt ?? (lift.tankers!.length === 1 && lift.liftedQty != null ? lift.liftedQty : t.actualQtyMt),
    }))
  }
  if (lift.tankerNo) {
    return [{
      tankerNo: formatTankerNo(lift.tankerNo),
      transportName: '',
      driverMobile: '',
      lrNo: '',
      actualQtyMt: lift.liftedQty,
    }]
  }
  return []
}

export function primaryTankerNo(lift: Pick<Lift, 'tankers' | 'tankerNo'>): string {
  const tankers = getLiftTankers(lift)
  return tankers[0]?.tankerNo ?? lift.tankerNo ?? ''
}

export function formatLiftTankerSummary(lift: Pick<Lift, 'tankers' | 'tankerNo'>): string {
  const tankers = getLiftTankers(lift).filter(t => t.tankerNo.trim())
  if (tankers.length === 0) return '—'
  const first = formatTankerNo(tankers[0].tankerNo)
  if (tankers.length === 1) return first
  return `${first} +${tankers.length - 1}`
}

export function normalizeLiftTankers(tankers: LiftTanker[]): LiftTanker[] {
  return tankers.map(t => ({
    tankerNo: formatTankerNo(t.tankerNo),
    transportName: t.transportName.trim(),
    driverMobile: t.driverMobile.trim(),
    lrNo: (t.lrNo ?? '').trim().toUpperCase(),
    actualQtyMt: t.actualQtyMt != null ? roundQtyMt(t.actualQtyMt) : undefined,
    ...(t.salesInvoiceNo?.trim() ? { salesInvoiceNo: t.salesInvoiceNo.trim() } : {}),
  }))
}

/** Invoice numbers on a delivered lift (per tanker, or lift-level fallback). */
export function liftSalesInvoiceNos(lift: Pick<Lift, 'salesInvoiceNo' | 'tankers' | 'tankerNo'>): string[] {
  const tankers = getLiftTankers(lift)
  const fromTankers = tankers.map(t => t.salesInvoiceNo?.trim()).filter(Boolean) as string[]
  if (fromTankers.length > 0) return fromTankers
  const liftLevel = lift.salesInvoiceNo?.trim()
  return liftLevel ? [liftLevel] : []
}

export function formatLiftSalesInvoices(lift: Pick<Lift, 'salesInvoiceNo' | 'tankers' | 'tankerNo'>): string {
  const nos = liftSalesInvoiceNos(lift)
  if (nos.length === 0) return '—'
  return nos.join(', ')
}

export type LiftTankerFieldErrorMap = Partial<
  Record<number, Partial<Record<keyof LiftTankerFormValues, string>>>
>

export function collectLiftTankerFieldErrors(
  tankers: LiftTankerFormValues[],
  qtyMode: 'planned' | 'actual' = 'planned',
  options?: { qtyRequired?: boolean; tankerNoRequired?: boolean; requireRow?: boolean },
): { message: string | null; fields: LiftTankerFieldErrorMap } {
  const qtyRequired = options?.qtyRequired !== false
  const tankerNoRequired = options?.tankerNoRequired !== false
  const requireRow = options?.requireRow !== false
  const qtyLabel = qtyMode === 'actual' ? 'actual quantity' : 'planned quantity'
  const fields: LiftTankerFieldErrorMap = {}

  const setField = (index: number, field: keyof LiftTankerFormValues, message: string) => {
    fields[index] = { ...fields[index], [field]: message }
  }

  const rowHasContent = (t: LiftTankerFormValues) =>
    t.tankerNo.trim() || t.transportName.trim() || t.driverMobile.trim() || t.lrNo.trim() || t.actualQty.trim()

  const filledCount = tankers.filter(rowHasContent).length
  if (requireRow && filledCount === 0) {
    setField(0, 'tankerNo', 'Add at least one tanker (details shared by buyer)')
    return { message: 'Add at least one tanker (details shared by buyer)', fields }
  }

  for (let i = 0; i < tankers.length; i++) {
    const tanker = tankers[i]
    if (!rowHasContent(tanker) && !requireRow) continue
    if (tankerNoRequired && !tanker.tankerNo.trim()) {
      setField(i, 'tankerNo', 'Enter tanker number')
    }
    if (qtyRequired && (!tanker.actualQty.trim() || parseFloat(tanker.actualQty) <= 0)) {
      setField(i, 'actualQty', `Enter ${qtyLabel}`)
    }
  }

  if (qtyRequired && totalActualQtyFromForm(tankers) <= 0) {
    const targetIndex = tankers.findIndex((t, i) => rowHasContent(t) || i === 0)
    if (targetIndex >= 0 && !fields[targetIndex]?.actualQty) {
      setField(targetIndex, 'actualQty', `Enter ${qtyLabel}`)
    }
  }

  const firstIndex = Object.keys(fields)
    .map(Number)
    .sort((a, b) => a - b)[0]
  if (firstIndex == null) return { message: null, fields }

  const firstField = fields[firstIndex]
  const firstMessage = firstField?.actualQty ?? firstField?.tankerNo ?? Object.values(firstField ?? {})[0]
  const message = firstMessage ? `Tanker ${firstIndex + 1}: ${firstMessage}` : null
  return { message, fields }
}

export function validateLiftTankerForms(
  tankers: LiftTankerFormValues[],
  qtyMode: 'planned' | 'actual' = 'planned',
  options?: { qtyRequired?: boolean; tankerNoRequired?: boolean; requireRow?: boolean },
): string | null {
  return collectLiftTankerFieldErrors(tankers, qtyMode, options).message
}

export function sanitizeQtyInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, '')
  const dotIndex = cleaned.indexOf('.')
  if (dotIndex === -1) return cleaned
  const intPart = cleaned.slice(0, dotIndex)
  const decPart = cleaned.slice(dotIndex + 1).replace(/\./g, '').slice(0, 3)
  if (decPart.length > 0) return `${intPart}.${decPart}`
  return cleaned.endsWith('.') ? `${intPart}.` : intPart
}
