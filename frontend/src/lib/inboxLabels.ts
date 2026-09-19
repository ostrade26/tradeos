/** Copy for Inbox — Received (to me) vs Sent (outbox). */

/** Shared shell copy — org and Tradeal admin use the same inbox UX. */
const inboxShellLabels = {
  pageTitle: 'Inbox',
  sidebarNav: 'Inbox',
  bellTitle: 'Inbox',
  bellEmpty: 'Messages addressed to you show up here.',
  receivedEmpty: 'Nothing received yet.',
  sentEmpty: 'Messages you send show up here.',
  bellViewAll: 'Open inbox →',
  commandPalette: 'Inbox',
  receivedTab: 'Received',
  sentTab: 'Sent',
} as const

export const platformActionInboxLabels = {
  ...inboxShellLabels,
  /** Platform compose opens Notify (broadcast), not Send-to-Tradeal. */
  composeCta: 'Send update',
} as const

export const orgNoticesLabels = {
  ...inboxShellLabels,
  composeCta: 'Send request',
} as const

export const platformBroadcastLabels = {
  modalTitle: 'Send update',
  modalSubtitle: 'Choose the update type first, then who should receive it.',
  orgDrawerAction: 'Notify',
  licencesAction: 'Notify licences',
} as const
