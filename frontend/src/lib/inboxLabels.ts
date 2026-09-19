/** Copy for Inbox — Received (to me) vs Sent (outbox). */

export const platformActionInboxLabels = {
  pageTitle: 'Inbox',
  sidebarNav: 'Inbox',
  bellTitle: 'Needs attention',
  bellEmpty: 'No open seat or product requests.',
  receivedEmpty: 'Nothing received yet.',
  sentEmpty: 'Nothing sent yet. Use Notify licences to broadcast updates.',
  bellViewAll: 'Open inbox →',
  commandPalette: 'Inbox',
  receivedTab: 'Received',
  sentTab: 'Sent',
} as const

export const orgNoticesLabels = {
  pageTitle: 'Inbox',
  sidebarNav: 'Inbox',
  bellTitle: 'From Tradeal',
  bellEmpty: 'Messages from Tradeal show up here.',
  receivedEmpty: 'Nothing from Tradeal yet.',
  sentEmpty: 'Requests you send to Tradeal show up here.',
  bellViewAll: 'Open inbox →',
  commandPalette: 'Inbox',
  receivedTab: 'Received',
  sentTab: 'Sent',
} as const

export const platformBroadcastLabels = {
  modalTitle: 'Send update',
  modalSubtitle: 'Choose the update type first, then who should receive it.',
  orgDrawerAction: 'Notify',
  licencesAction: 'Notify licences',
} as const
