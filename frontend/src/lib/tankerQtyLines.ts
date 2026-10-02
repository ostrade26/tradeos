import type { BrokerContractLiftTanker } from '../api/organisationApi'
import type { Lift } from '../data/mockData'
import { computeBalanceQty, getLiftBalanceQty, getLiftPlannedQty } from './liftBalance'
import { getLiftTankers } from './liftTankers'
import { roundQtyMt } from './utils'

export interface TankerQtyLine {
  tankerNo: string
  plannedMt: number | null
  actualMt: number | null
  balanceMt: number | null
  changed?: boolean
  previous?: string
}

function splitBalanceAcrossTankers(totalBalance: number, weights: number[]): number[] {
  if (totalBalance <= 0.0005 || weights.length === 0) return weights.map(() => 0)
  const sum = weights.reduce((acc, w) => acc + w, 0)
  const basis = sum > 0 ? weights : weights.map(() => 1)
  const basisSum = basis.reduce((acc, w) => acc + w, 0)
  const parts = basis.map(w => roundQtyMt(totalBalance * (w / basisSum)))
  const drift = roundQtyMt(totalBalance - parts.reduce((acc, w) => acc + w, 0))
  if (Math.abs(drift) > 0.0005) {
    parts[parts.length - 1] = roundQtyMt(parts[parts.length - 1] + drift)
  }
  return parts
}

export function tankerQtyLinesFromLift(lift: Lift): TankerQtyLine[] {
  const tankers = getLiftTankers(lift)
  const delivered = lift.status === 'delivered'
  const liftBalance = delivered ? getLiftBalanceQty(lift) : 0
  const liftPlanned = getLiftPlannedQty(lift)

  if (tankers.length === 0) {
    return [{
      tankerNo: '',
      plannedMt: liftPlanned,
      actualMt: delivered ? lift.liftedQty : null,
      balanceMt: delivered && liftBalance > 0.0005 ? liftBalance : null,
    }]
  }

  if (!delivered) {
    return tankers.map(tanker => ({
      tankerNo: tanker.tankerNo,
      plannedMt: roundQtyMt(
        tanker.actualQtyMt ?? (tankers.length === 1 ? lift.liftedQty : 0),
      ),
      actualMt: null,
      balanceMt: null,
    }))
  }

  const actuals = tankers.map(tanker =>
    roundQtyMt(tanker.actualQtyMt ?? (tankers.length === 1 ? lift.liftedQty : 0)),
  )
  const balanceParts = splitBalanceAcrossTankers(liftBalance, actuals)

  return tankers.map((tanker, index) => {
    const actual = actuals[index] ?? 0
    const balance = balanceParts[index] ?? 0
    const planned = roundQtyMt(actual + balance)
    return {
      tankerNo: tanker.tankerNo,
      plannedMt: planned > 0 ? planned : liftPlanned,
      actualMt: actual,
      balanceMt: balance > 0.0005 ? balance : null,
    }
  })
}

export function tankerQtyLinesFromBrokerEvent(
  tankers: BrokerContractLiftTanker[],
  event: { qty_mt: number; short_qty_mt?: number; status: string },
): TankerQtyLine[] {
  const delivered = event.status === 'delivered'
  const liftBalance = delivered ? Number(event.short_qty_mt) || 0 : 0
  const eventQty = Number(event.qty_mt) || 0

  if (tankers.length === 0) {
    return [{
      tankerNo: '',
      plannedMt: eventQty,
      actualMt: delivered ? eventQty : null,
      balanceMt: delivered && liftBalance > 0.0005 ? liftBalance : null,
    }]
  }

  if (!delivered) {
    return tankers.map(tanker => ({
      tankerNo: tanker.tanker_no,
      plannedMt: roundQtyMt(
        tanker.planned_qty_mt != null && tanker.planned_qty_mt > 0
          ? tanker.planned_qty_mt
          : tanker.qty_mt > 0
            ? tanker.qty_mt
            : tankers.length === 1
              ? eventQty
              : 0,
      ),
      actualMt: null,
      balanceMt: null,
      changed: tanker.tanker_changed,
      previous: tanker.previous_tanker_no,
    }))
  }

  const actuals = tankers.map(tanker =>
    roundQtyMt(
      tanker.actual_qty_mt != null && tanker.actual_qty_mt > 0
        ? tanker.actual_qty_mt
        : tanker.qty_mt > 0
          ? tanker.qty_mt
          : tankers.length === 1
            ? eventQty
            : 0,
    ),
  )
  const balanceParts = splitBalanceAcrossTankers(liftBalance, actuals)

  return tankers.map((tanker, index) => {
    const actual = actuals[index] ?? 0
    const balance = balanceParts[index] ?? 0
    const plannedFromApi = tanker.planned_qty_mt
    const planned = plannedFromApi != null && plannedFromApi > 0
      ? roundQtyMt(plannedFromApi)
      : roundQtyMt(actual + balance)
    return {
      tankerNo: tanker.tanker_no,
      plannedMt: planned,
      actualMt: actual,
      balanceMt: balance > 0.0005 ? balance : computeBalanceQty(planned, actual) > 0.0005
        ? computeBalanceQty(planned, actual)
        : null,
      changed: tanker.tanker_changed,
      previous: tanker.previous_tanker_no,
    }
  })
}

export function usesMultiTankerQtyLines(lines: TankerQtyLine[]): boolean {
  return lines.length > 1
}
