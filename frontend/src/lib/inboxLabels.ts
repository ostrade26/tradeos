/** Copy for action inbox (platform work) vs notices (org comms from Tradeal). */

export const platformActionInboxLabels = {
  pageTitle: 'Inbox',
  sidebarNav: 'Inbox',
  bellTitle: 'Needs attention',
  bellEmpty: 'No open seat or product requests.',
  bellViewAll: 'Open inbox →',
  commandPalette: 'Inbox',
} as const

export const orgNoticesLabels = {
  pageTitle: 'Inbox',
  sidebarNav: 'Inbox',
  bellTitle: 'From Tradeal',
  bellEmpty: 'Messages from Tradeal and other accounts show up here.',
  bellViewAll: 'Open inbox →',
  commandPalette: 'Inbox',
} as const

export const platformBroadcastLabels = {
  modalTitle: 'Send update to customers',
  modalSubtitle: 'Delivered in-app as From Tradeal',
  orgDrawerAction: 'Send update to customers',
  licencesAction: 'Send update to active licences',
} as const
