import { DetailInlineStat, DetailInlineStatRow } from '../registers/DetailPanelSections'
import { formatQty } from '../../lib/utils'

interface DeliveryQtySummaryProps {
  planned: number
  actual: number
  balance?: number
}

export function DeliveryQtySummary({ planned, actual, balance }: DeliveryQtySummaryProps) {
  const balanceOwed = balance ?? 0
  const showBalance = balanceOwed > 0 && actual > 0

  return (
    <DetailInlineStatRow>
      <DetailInlineStat label="Planned" value={formatQty(planned)} />
      <DetailInlineStat label="Actual" value={formatQty(actual)} />
      <DetailInlineStat
        label="Balance owed"
        value={showBalance ? formatQty(balanceOwed) : '—'}
        valueClassName={showBalance ? 'text-warning' : 'text-muted'}
      />
    </DetailInlineStatRow>
  )
}
