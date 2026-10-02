/** Tell contract UIs to reload broker share lists from the identity API. */
export const CONTRACT_SHARES_REFRESH_EVENT = 'contract-shares-refresh'

export function dispatchContractSharesRefresh(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(CONTRACT_SHARES_REFRESH_EVENT))
}
