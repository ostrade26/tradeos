import { Check, Copy, Mail, MessageCircle, AlertCircle } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import type { BrokerContractDeliverySide, BrokerContractParty, BrokerContractShare } from '../../api/organisationApi'
import { contractShareWhatsAppText } from '../../lib/brokerContractInvite'
import { openWhatsAppShare } from '../../lib/whatsappShare'
import { useToast } from '../../hooks/useToast'

function copyText(text: string, label: string, toast: ReturnType<typeof useToast>) {
  void navigator.clipboard.writeText(text).then(
    () => toast.success(`${label} copied`),
    () => toast.error(`Could not copy ${label.toLowerCase()}`),
  )
}

function SideDelivery({
  label,
  side,
}: {
  label: string
  side: BrokerContractDeliverySide | undefined
}) {
  const toast = useToast()
  const [copiedLink, setCopiedLink] = useState(false)

  if (!side) return null

  if (side.channel === 'tradeal') {
    return (
      <div className="rounded-md border border-gray-200 px-4 py-3 dark:border-gray-700">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-heading">{label}</p>
          <Badge variant="success">On Tradeal</Badge>
        </div>
        <p className="text-sm text-muted mt-1">Notified in their Tradeal inbox.</p>
      </div>
    )
  }

  const emailNote = side.email_sent
    ? 'Email sent with PDF attached.'
    : side.invite_url
      ? 'Email was not sent — copy the link or share on WhatsApp.'
      : 'Add an email address to send the PDF automatically.'

  return (
    <div className="rounded-md border border-gray-200 px-4 py-3 dark:border-gray-700">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-heading">{label}</p>
        <Badge variant="warning">Not on Tradeal</Badge>
      </div>
      <p className="text-sm text-muted mt-1 flex items-start gap-1.5">
        {side.email_sent ? <Check className="h-4 w-4 shrink-0 text-success mt-0.5" /> : <AlertCircle className="h-4 w-4 shrink-0 text-warning mt-0.5" />}
        <span>{emailNote}</span>
      </p>
      {side.invite_url ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              copyText(side.invite_url!, 'Link', toast)
              setCopiedLink(true)
              window.setTimeout(() => setCopiedLink(false), 2000)
            }}
          >
            <Copy className="h-4 w-4" /> {copiedLink ? 'Copied' : 'Copy link'}
          </Button>
          {side.whatsapp_text ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openWhatsAppShare(side.whatsapp_text!, side.phone)}
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </Button>
          ) : null}
          {side.email_sent ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted">
              <Mail className="h-3.5 w-3.5" /> Email sent
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function ContractDeliveryPanel({
  buyer,
  seller,
}: {
  buyer?: BrokerContractDeliverySide
  seller?: BrokerContractDeliverySide
}) {
  if (!buyer && !seller) return null
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Delivery</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SideDelivery label="Buyer" side={buyer} />
        <SideDelivery label="Seller" side={seller} />
      </div>
    </div>
  )
}

export function contractPartyDeliverySide(
  share: BrokerContractShare,
  party: BrokerContractParty | undefined,
  role: 'buyer' | 'seller',
): BrokerContractDeliverySide | undefined {
  if (!party) return undefined
  if (party.channel === 'tradeal') return { channel: 'tradeal', email_sent: false }
  const inviteUrl = party.invite_url
  return {
    channel: 'external',
    email_sent: party.email_sent,
    invite_url: inviteUrl,
    phone: party.phone,
    whatsapp_text: inviteUrl
      ? contractShareWhatsAppText(share, role, inviteUrl, party.name)
      : undefined,
  }
}

export function ContractShareDeliveryPanel({ share }: { share: BrokerContractShare }) {
  if (share.role !== 'broker') return null
  return (
    <ContractDeliveryPanel
      buyer={contractPartyDeliverySide(share, share.buyer_party, 'buyer')}
      seller={contractPartyDeliverySide(share, share.seller_party, 'seller')}
    />
  )
}
