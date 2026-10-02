import { StatusBadge } from '../ui/Badge'
import { brokerContractStatus } from '../../lib/brokerContractStatus'
import type { BrokerContractShare } from '../../api/organisationApi'

export function OngoingContractStatus({ share }: { share: BrokerContractShare }) {
  const status = brokerContractStatus(share)
  const live = status !== 'completed' && status !== 'deleted'
  return (
    <span className="inline-flex items-center gap-2">
      {live ? (
        <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </span>
      ) : null}
      <StatusBadge status={status} />
    </span>
  )
}
