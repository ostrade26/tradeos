import { useState } from 'react'
import { Modal } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { organisationApi, type BrokerContractShare } from '../../api/organisationApi'
import { ApiError } from '../../api/client'
import { useToast } from '../../hooks/useToast'
import { formatCurrency, formatQty } from '../../lib/utils'
import { parseIndianAmount } from '../../lib/indianAmount'
import { orderLineAmount } from '../../lib/orderRate'
import signingContract from '../../assets/illustrations/signing-a-contract.png'

function splitDelivery(period: string): { delivery: string; location: string } {
  const parts = period.split(' · ').map(part => part.trim()).filter(Boolean)
  if (parts.length === 0) return { delivery: '', location: '' }
  const [first, ...rest] = parts
  if (/^ready$/i.test(first)) return { delivery: 'Ready', location: rest.join(' · ') }
  return { delivery: first, location: rest.join(' · ') }
}

export function ContractReceiveModal({
  share,
  open,
  loading = false,
  onClose,
  onConfirmed,
  draft,
  onSend,
}: {
  share: BrokerContractShare | null
  open: boolean
  loading?: boolean
  onClose: () => void
  onConfirmed?: (share: BrokerContractShare) => void
  /** Review a contract that has not been sent yet. Confirm calls onSend. */
  draft?: {
    heading: string
    caption: string
    facts: { label: string; value: string }[]
  } | null
  onSend?: () => Promise<void>
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const mineConfirmed = share
    ? share.role === 'buyer'
      ? share.buyer_confirmed
      : share.role === 'seller'
        ? share.seller_confirmed
        : true
    : false
  const canConfirm = draft
    ? true
    : share != null && (share.role === 'buyer' || share.role === 'seller') && !mineConfirmed
  const roleLabel = share?.role === 'buyer' ? 'buyer' : share?.role === 'seller' ? 'seller' : 'party'
  const delivery = splitDelivery(share?.delivery_period || '')
  const quantity = parseFloat(share?.quantity || '') || 0
  const rate = parseIndianAmount(share?.rate || '')
  const value = orderLineAmount(quantity, rate)
  const counterparty = share?.role === 'seller' ? share.buyer_name : share?.seller_name

  const confirm = async () => {
    if (draft && onSend) {
      setBusy(true)
      try {
        await onSend()
        onClose()
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : 'Could not send contract')
      } finally {
        setBusy(false)
      }
      return
    }
    if (!share || !canConfirm) return
    setBusy(true)
    try {
      const res = await organisationApi.confirmBrokerShare(share.id)
      const next = res.share
      toast.success(
        next.buyer_confirmed && next.seller_confirmed
          ? 'Confirmed. Both parties have confirmed this contract.'
          : 'Confirmed. The broker has been notified.',
      )
      onConfirmed?.(next)
      onClose()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not confirm contract')
    } finally {
      setBusy(false)
    }
  }

  const facts = share
    ? [
        { label: 'Commodity', value: share.item_name },
        { label: 'Quantity', value: formatQty(quantity, 'MT') },
        { label: 'Rate', value: rate ? `${formatCurrency(rate)}/10 KG` : '' },
        { label: 'Value', value: formatCurrency(value) },
        { label: share.role === 'seller' ? 'Buyer' : 'Seller', value: counterparty || '' },
        { label: 'Delivery', value: delivery.delivery },
        { label: 'Location', value: delivery.location },
        { label: 'Payment', value: share.payment_terms },
      ].filter(item => item.value)
    : []

  return (
    <Modal
      open={open}
      onClose={() => { if (!busy) onClose() }}
      title="Contract Confirmation"
      hideHeader
      size="md"
      dismissible={!busy}
      bodyClassName="!p-0"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Close
          </Button>
          {canConfirm ? (
            <Button type="button" onClick={() => void confirm()} loading={busy}>
              Confirm
            </Button>
          ) : null}
        </>
      }
    >
      <div className="bg-gradient-to-b from-sky-100 to-sky-50 px-6 pt-10 pb-8 text-center dark:from-sky-950/40 dark:to-sky-950/10">
        <img
          src={signingContract}
          alt=""
          className="mx-auto h-44 w-auto object-contain"
        />
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-heading">Contract Confirmation</h2>
        <p className="mt-2 text-base text-heading/80">
          {draft
            ? draft.caption
            : share
              ? `From ${share.sender_name}. Confirm as the ${roleLabel}.`
              : 'Review the contract, then confirm.'}
        </p>
      </div>
      <div className="px-6 py-6">
        {loading ? (
          <p className="text-sm text-muted">Loading contract…</p>
        ) : draft ? (
          <>
            <h3 className="text-lg font-semibold text-heading">{draft.heading}</h3>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3">
              {draft.facts.map(item => (
                <div key={item.label}>
                  <dt className="text-xs text-muted">{item.label}</dt>
                  <dd className="text-sm font-medium text-heading mt-0.5">{item.value}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : !share ? (
          <p className="text-sm text-muted">Loading contract…</p>
        ) : (
          <>
            <h3 className="text-lg font-semibold text-heading">{share.contract_ref}</h3>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3">
              {facts.map(item => (
                <div key={item.label}>
                  <dt className="text-xs text-muted">{item.label}</dt>
                  <dd className="text-sm font-medium text-heading mt-0.5">{item.value}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </div>
    </Modal>
  )
}
