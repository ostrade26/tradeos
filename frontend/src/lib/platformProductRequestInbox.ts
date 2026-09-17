import type { ProductRequest } from '../api/platformApi'
import type { InboxAction } from './actionInbox'
import { productRequestKindLabel, productRequestPriorityShort, productRequestStatusLabel } from './platformLabels'

export function isOpenProductRequest(status: string): boolean {
  return status === 'received' || status === 'in_progress'
}

export function buildPlatformProductRequestInbox(requests: ProductRequest[]): InboxAction[] {
  return requests.map(r => {
    const org = r.organisation_name?.trim() || `Organisation #${r.organisation_id}`
    const who = r.requested_by_name?.trim() || r.requested_by_username?.trim() || 'A user'
    const kind = productRequestKindLabel(r.kind)
    const snippet = r.message.trim().replace(/\s+/g, ' ').slice(0, 90)
    const open = isOpenProductRequest(r.status)
    const statusBit = open ? '' : ` · ${productRequestStatusLabel(r.status)}`
    const pShort = productRequestPriorityShort(r.priority || 'p3')
    const urgency = r.priority === 'p1' && open ? 'high' : r.priority === 'p2' && open ? 'medium' : open ? 'low' : 'low'
    return {
      id: `product-request-${r.id}`,
      kind: 'product_request',
      title: `${org} · ${pShort} ${kind}${statusBit}`,
      subtitle: `${who} · ${snippet}`,
      href: '',
      urgency,
      from: org,
      createdAt: r.created_at,
      actionable: open,
      productRequest: r,
    }
  })
}
