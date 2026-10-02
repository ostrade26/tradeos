import { useMemo, useState } from 'react'
import { BadgeCheck, FileText, IndianRupee, MessageCircle, PanelRight, PanelRightClose, Plus, Truck, Users } from 'lucide-react'
import { Drawer, DockedPanel } from '../ui/Drawer'
import { Button } from '../ui/Button'
import { StatusBadge } from '../ui/Badge'
import { DetailPanelMenu, groupMenuItems, type DetailPanelMenuItem } from '../ui/DetailPanelMenu'
import {
  DetailGroup,
  DetailHero,
  DetailInlineStat,
  DetailInlineStatRow,
  DetailMetricsSection,
  DetailPanelBody,
  DetailRow,
} from '../registers/DetailPanelSections'
import { ConfirmationProgress } from './ConfirmationProgress'
import { organisationApi, type BrokerContractShare } from '../../api/organisationApi'
import { formatCurrency, formatDateTime, formatQty, normalizeDateToIso } from '../../lib/utils'
import { parseIndianAmount } from '../../lib/indianAmount'
import { orderLineAmount } from '../../lib/orderRate'
import { appPath } from '../../lib/appShellMode'
import { useToast } from '../../hooks/useToast'
import { ApiError } from '../../api/client'
import { formatLiftRef } from '../../lib/tradeRefs'
import { brokerContractStatus, deliveredQtyMt } from '../../lib/brokerContractStatus'

const actionBtnClass = 'h-auto w-full py-2.5 text-sm'

function placeOf(city: string, state: string): string {
  return [city, state].filter(Boolean).join(', ')
}

function PartySection({
  title,
  name,
  legalName,
  city,
  state,
  gstin,
  orgCode,
}: {
  title: string
  name: string
  legalName: string
  city: string
  state: string
  gstin: string
  orgCode: string
}) {
  return (
    <DetailGroup title={title} icon={Users}>
      <DetailRow label="Name" value={name} />
      <DetailRow label="Legal name" value={legalName && legalName !== name ? legalName : ''} />
      <DetailRow label="Location" value={placeOf(city, state)} />
      <DetailRow label="GSTIN" value={gstin} mono />
      <DetailRow label="Org code" value={orgCode} mono />
    </DetailGroup>
  )
}

export function bothPartiesConfirmed(share: BrokerContractShare): boolean {
  return Boolean(share.buyer_confirmed && share.seller_confirmed)
}

function contractDeliveryParams(period: string): { type: 'ready' | 'period'; from?: string; to?: string } {
  const head = (period.split(' · ')[0] || '').trim()
  if (!head || /^ready$/i.test(head)) return { type: 'ready' }
  const [startLabel, endLabel] = head.split(' – ').map(part => part.trim())
  const from = normalizeDateToIso(startLabel || '')
  const to = normalizeDateToIso(endLabel || startLabel || '')
  return { type: 'period', ...(from ? { from } : {}), ...(to ? { to } : {}) }
}

export function orderFromContractHref(share: BrokerContractShare): string {
  const params = new URLSearchParams()
  if (share.quantity) params.set('qty', share.quantity)
  if (share.rate) params.set('rate', share.rate)
  if (share.item_name) params.set('item', share.item_name)
  if (share.sender_name) params.set('broker', share.sender_name)
  if (share.contract_ref) params.set('contract', share.contract_ref)
  if (share.payment_terms) params.set('payment', share.payment_terms)
  const delivery = contractDeliveryParams(share.delivery_period)
  params.set('delivery', delivery.type)
  if (delivery.from) params.set('deliveryFrom', delivery.from)
  if (delivery.to) params.set('deliveryTo', delivery.to)
  params.set('share', String(share.id))
  if (share.role === 'buyer') {
    if (share.seller_name) params.set('party', share.seller_name)
    return appPath(`/purchase-orders/new?${params.toString()}`)
  }
  if (share.role === 'seller') {
    if (share.buyer_name) params.set('buyer', share.buyer_name)
    return appPath(`/sales-orders/new?${params.toString()}`)
  }
  return ''
}

export function ContractConfirmationPanel({
  share,
  open,
  onClose,
  docked = false,
  onDockChange,
  onShareChange,
}: {
  share: BrokerContractShare | null
  open: boolean
  onClose: () => void
  docked?: boolean
  onDockChange?: (docked: boolean) => void
  onShareChange?: (share: BrokerContractShare) => void
}) {
  const toast = useToast()
  const [confirming, setConfirming] = useState(false)

  const download = async () => {
    if (!share) return
    try {
      const res = await organisationApi.getBrokerShare(share.id, true)
      const data = res.share.pdf_data || ''
      if (!data) {
        toast.error('This contract has no PDF')
        return
      }
      const anchor = document.createElement('a')
      anchor.href = data
      anchor.download = res.share.filename || `${share.contract_ref}.pdf`
      anchor.click()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not download PDF')
    }
  }

  const menuItems = useMemo((): DetailPanelMenuItem[] => {
    if (!share) return []
    const href = bothPartiesConfirmed(share) ? orderFromContractHref(share) : ''
    const booked = share.role === 'buyer' ? share.buyer_order_ref : share.role === 'seller' ? share.seller_order_ref : ''
    return groupMenuItems([
      {
        items: [
          ...(!booked && href
            ? [{
                type: 'link' as const,
                label: share.role === 'buyer' ? 'Generate PO' : 'Generate SO',
                icon: Plus,
                href,
              }]
            : []),
        ],
      },
      {
        items: [
          ...(share.filename
            ? [{
                type: 'button' as const,
                label: 'Download PDF',
                icon: FileText,
                onClick: () => void download(),
              }]
            : []),
          {
            type: 'button',
            label: 'WhatsApp',
            icon: MessageCircle,
            tone: 'whatsapp',
            onClick: () => {
              const text = [
                `Contract ${share.contract_ref}`,
                share.item_name,
                share.quantity && `${share.quantity} MT`,
                share.buyer_name && `Buyer ${share.buyer_name}`,
                share.seller_name && `Seller ${share.seller_name}`,
              ].filter(Boolean).join('\n')
              window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
            },
          },
        ],
      },
    ])
  }, [share])

  if (!share || !open) return null

  const booked = share.role === 'buyer' ? share.buyer_order_ref : share.role === 'seller' ? share.seller_order_ref : ''
  const ready = bothPartiesConfirmed(share)
  const href = ready ? orderFromContractHref(share) : ''
  const mineConfirmed = share.role === 'buyer' ? share.buyer_confirmed : share.role === 'seller' ? share.seller_confirmed : false
  const status = brokerContractStatus(share)
  const delivered = deliveredQtyMt(share)

  const confirmContract = async () => {
    setConfirming(true)
    try {
      const res = await organisationApi.confirmBrokerShare(share.id)
      const next = res.share
      toast.success(
        bothPartiesConfirmed(next)
          ? 'Confirmed. Both parties have confirmed this contract.'
          : 'Confirmed. The broker has been notified.',
      )
      onShareChange?.(next)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not confirm contract')
    } finally {
      setConfirming(false)
    }
  }
  const quantity = parseFloat(share.quantity) || 0
  const rate = parseIndianAmount(share.rate)
  const value = orderLineAmount(quantity, rate)

  const dockToggle = onDockChange && (
    <button
      type="button"
      onClick={() => onDockChange(!docked)}
      className="hidden lg:inline-flex rounded-lg p-1.5 text-muted hover:bg-gray-100 hover:text-heading dark:hover:bg-zinc-800 cursor-pointer attex-focus"
      aria-label={docked ? 'Undock panel' : 'Dock panel to the right'}
      title={docked ? 'Undock panel' : 'Dock to right'}
    >
      {docked ? <PanelRightClose className="h-4 w-4" /> : <PanelRight className="h-4 w-4" />}
    </button>
  )

  const headerActions = (
    <>
      {dockToggle}
      <DetailPanelMenu onItemSelect={onClose} items={menuItems} />
    </>
  )

  const footer = (share.role === 'buyer' || share.role === 'seller') && !mineConfirmed ? (
    <Button type="button" size="sm" className={actionBtnClass} loading={confirming} onClick={() => void confirmContract()}>
      Confirm contract
    </Button>
  ) : !booked && href ? (
    <Button to={href} size="sm" className={actionBtnClass} onClick={onClose}>
      <Plus className="h-4 w-4" /> {share.role === 'buyer' ? 'Generate PO' : 'Generate SO'}
    </Button>
  ) : booked ? (
    <Button
      to={share.role === 'buyer'
        ? appPath(`/purchase-orders?ref=${encodeURIComponent(booked)}`)
        : appPath(`/sales-orders?ref=${encodeURIComponent(booked)}`)}
      variant="secondary"
      size="sm"
      className={actionBtnClass}
      onClick={onClose}
    >
      {share.role === 'buyer' ? `Open ${booked}` : `Open ${booked}`}
    </Button>
  ) : null

  const content = (
    <DetailPanelBody>
      <DetailHero>
        <div className="min-w-0">
          <p className="text-base font-semibold text-heading leading-snug">{share.item_name || 'Contract'}</p>
          <div className="flex items-start justify-between gap-3 mt-0.5">
            <p className="text-[14px] text-muted leading-snug min-w-0">{share.sender_name}</p>
            <StatusBadge status={status} />
          </div>
        </div>
      </DetailHero>

      <DetailMetricsSection>
        <DetailInlineStatRow>
          <DetailInlineStat label="Quantity" value={formatQty(quantity, 'MT')} />
          <DetailInlineStat label="Value" value={formatCurrency(value)} />
          <DetailInlineStat label="Brokerage" value={share.brokerage || '—'} />
        </DetailInlineStatRow>
      </DetailMetricsSection>

      {share.role !== 'buyer' && (
        <PartySection
          title="Buyer"
          name={share.buyer_name}
          legalName={share.buyer_legal_name}
          city={share.buyer_city}
          state={share.buyer_state}
          gstin={share.buyer_gstin}
          orgCode={share.buyer_org_code}
        />
      )}
      {share.role !== 'seller' && (
        <PartySection
          title="Seller"
          name={share.seller_name}
          legalName={share.seller_legal_name}
          city={share.seller_city}
          state={share.seller_state}
          gstin={share.seller_gstin}
          orgCode={share.seller_org_code}
        />
      )}

      <DetailGroup title="Confirmation" icon={BadgeCheck}>
        <ConfirmationProgress
          buyerConfirmed={share.buyer_confirmed}
          sellerConfirmed={share.seller_confirmed}
          role={share.role}
        />
      </DetailGroup>

      <DetailGroup title="Movement" icon={Truck}>
        <DetailRow
          label="Delivered"
          value={quantity > 0 ? `${formatQty(delivered, 'MT')} of ${formatQty(quantity, 'MT')}` : formatQty(delivered, 'MT')}
          highlight={status === 'completed'}
        />
        {(share.lift_events ?? []).map(event => (
          <DetailRow
            key={event.id}
            label={`${event.party_name || event.party_role} · ${formatLiftRef(event.lift_ref)}`}
            value={`${formatQty(event.qty_mt, 'MT')} · ${event.status === 'delivered' ? 'Delivered' : 'In transit'} · ${event.order_ref}`}
          />
        ))}
      </DetailGroup>

      <DetailGroup title="Pricing" icon={IndianRupee}>
        <DetailRow label="Contract rate" value={rate ? `${formatCurrency(rate)}/10 KG` : ''} highlight />
        <DetailRow label="Brokerage" value={share.brokerage} />
        {share.note ? <DetailRow label="Note" value={share.note} /> : null}
      </DetailGroup>

      <DetailGroup title="Terms & broker" icon={FileText}>
        <DetailRow label="Broker" value={share.sender_name} />
        <DetailRow label="Contract #" value={share.contract_ref} />
        <DetailRow label="Delivery" value={share.delivery_period} />
        <DetailRow label="Payment terms" value={share.payment_terms} />
        <DetailRow label="Received" value={formatDateTime(share.created_at)} />
        {booked ? <DetailRow label={share.role === 'buyer' ? 'Purchase' : 'Sale'} value={booked} highlight /> : null}
      </DetailGroup>
    </DetailPanelBody>
  )

  const panelProps = {
    title: share.contract_ref,
    subtitle: share.role === 'buyer'
      ? `Contract · ${share.seller_name}`
      : share.role === 'seller'
        ? `Contract · ${share.buyer_name}`
        : `Contract · ${share.buyer_name} · ${share.seller_name}`,
    footer,
    onClose,
    headerActions,
    width: 'lg' as const,
  }

  if (docked) {
    return <DockedPanel {...panelProps}>{content}</DockedPanel>
  }

  return (
    <Drawer open={open} variant="registerDetail" {...panelProps}>
      {content}
    </Drawer>
  )
}

