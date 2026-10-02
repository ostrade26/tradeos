import type { BrokerContractShare } from '../api/organisationApi'

export function contractShareWhatsAppText(
  share: Pick<BrokerContractShare, 'contract_ref' | 'item_name' | 'quantity' | 'rate' | 'sender_name'>,
  partyRole: 'buyer' | 'seller',
  inviteUrl: string,
  partyName?: string,
): string {
  const roleLabel = partyRole === 'buyer' ? 'Buyer' : 'Seller'
  const terms = [share.item_name, share.quantity ? `${share.quantity} MT` : '', share.rate ? `rate ${share.rate}` : '']
    .filter(Boolean)
    .join(' · ')
  const lines = [
    `*Contract ${share.contract_ref}*`,
    `From *${share.sender_name || 'Your broker'}* · You are the *${roleLabel}*`,
  ]
  if (partyName?.trim()) lines.push(`*${partyName.trim()}*`)
  if (terms) lines.push(terms)
  lines.push(`View PDF: ${inviteUrl}`)
  lines.push('_Sent via Tradeal_')
  return lines.join('\n')
}
