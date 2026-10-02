import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Download, FileText } from 'lucide-react'
import { organisationApi, type PublicContractInvite } from '../api/organisationApi'
import { ApiError } from '../api/client'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/Tabs'
import { formatCurrency, formatQty } from '../lib/utils'
import { parseIndianAmount } from '../lib/indianAmount'
import { orderLineAmount } from '../lib/orderRate'

export function ContractInvitePage() {
  const { token = '' } = useParams()
  const [invite, setInvite] = useState<PublicContractInvite | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    organisationApi.getPublicContractInvite(token)
      .then(res => {
        if (!cancelled) setInvite(res.invite)
      })
      .catch(err => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'This link is not valid')
        }
      })
    return () => {
      cancelled = true
    }
  }, [token])

  if (error) {
    return (
      <div className="min-h-viewport flex items-center justify-center p-6 bg-body">
        <EmptyState
          card
          icon={<FileText className="h-10 w-10" />}
          title="Contract not available"
          description={error}
        />
      </div>
    )
  }

  if (!invite) {
    return (
      <div className="min-h-viewport flex items-center justify-center p-6 bg-body">
        <p className="text-sm text-muted">Loading contract…</p>
      </div>
    )
  }

  const qty = parseFloat(invite.quantity) || 0
  const rate = parseIndianAmount(invite.rate)
  const value = orderLineAmount(qty, rate)
  const roleLabel = invite.party_role === 'buyer' ? 'Buyer' : 'Seller'

  const download = () => {
    if (!invite.pdf_data) return
    const anchor = document.createElement('a')
    anchor.href = invite.pdf_data
    anchor.download = invite.filename || `${invite.contract_ref}.pdf`
    anchor.click()
  }

  return (
    <div className="min-h-viewport bg-body px-4 py-10">
      <div className="mx-auto max-w-lg space-y-6">
        <div className="text-center space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Contract from {invite.broker_name}</p>
          <h1 className="text-xl font-semibold text-heading">{invite.contract_ref}</h1>
          <p className="text-sm text-muted">You are listed as the {roleLabel.toLowerCase()}.</p>
        </div>

        <div className="rounded-md bg-card shadow-[var(--shadow-card)] p-6 space-y-3">
          {invite.item_name ? (
            <div className="flex justify-between gap-3 text-sm">
              <span className="text-muted">Commodity</span>
              <span className="font-medium text-heading">{invite.item_name}</span>
            </div>
          ) : null}
          {qty > 0 ? (
            <div className="flex justify-between gap-3 text-sm">
              <span className="text-muted">Quantity</span>
              <span className="font-medium tabular-nums text-heading">{formatQty(qty, 'MT')}</span>
            </div>
          ) : null}
          {rate > 0 ? (
            <div className="flex justify-between gap-3 text-sm">
              <span className="text-muted">Value</span>
              <span className="font-medium tabular-nums text-heading">{formatCurrency(value)}</span>
            </div>
          ) : null}
          {invite.delivery_period ? (
            <div className="flex justify-between gap-3 text-sm">
              <span className="text-muted">Delivery</span>
              <span className="text-right text-heading">{invite.delivery_period}</span>
            </div>
          ) : null}
          {invite.counterparty_name ? (
            <div className="flex justify-between gap-3 text-sm">
              <span className="text-muted">Counterparty</span>
              <span className="text-heading">{invite.counterparty_name}</span>
            </div>
          ) : null}
        </div>

        {invite.pdf_data ? (
          <Button className="w-full" onClick={download}>
            <Download className="h-4 w-4" /> Download contract PDF
          </Button>
        ) : (
          <p className="text-sm text-center text-muted">PDF not attached — contact your broker.</p>
        )}

        <p className="text-xs text-center text-muted leading-relaxed">
          When your organisation joins Tradeal, your broker can link this contract so you can confirm and book orders in the app.
        </p>
      </div>
    </div>
  )
}
