export const PRODUCT_GUIDE_TOUR_PREF_KEY = 'completedOrgProductTour' as const

const PENDING_TOUR_SESSION_KEY = 'tradeal-pending-product-tour'

export interface ProductGuideTourStep {
  id: string
  target: string
  title: string
  body: string
}

export const ORG_PRODUCT_GUIDE_STEPS: ProductGuideTourStep[] = [
  {
    id: 'nav-trading',
    target: '[data-tour="nav-trading"]',
    title: 'Your trading desk',
    body: 'Purchase orders, sales orders, lifts, inventory, and contracts live here — your day-to-day workflow.',
  },
  {
    id: 'nav-po',
    target: '[data-tour="nav-purchase-orders"]',
    title: 'Start with purchase orders',
    body: 'Record inbound deals first. Inventory and lifts flow from your open POs.',
  },
  {
    id: 'nav-lifts',
    target: '[data-tour="nav-lifts"]',
    title: 'Lift register',
    body: 'Track tankers and quantities lifted against POs and SOs in one register.',
  },
  {
    id: 'header-search',
    target: '[data-tour="header-search"]',
    title: 'Search anything',
    body: 'Jump to orders, parties, or lifts quickly. Press ⌘K (Ctrl+K on Windows) from anywhere.',
  },
  {
    id: 'create-actions',
    target: '[data-tour="dashboard-quick-actions"], [data-tour="create-fab"]',
    title: 'Create trade quickly',
    body: 'Start a PO, SO, or lift from the dashboard on desktop, or the + button on mobile.',
  },
  {
    id: 'header-notifications',
    target: '[data-tour="header-notifications"]',
    title: 'Notifications',
    body: 'Tradeal updates, seat requests, and messages from your team appear under the bell.',
  },
]

export function markPendingProductTour() {
  try {
    sessionStorage.setItem(PENDING_TOUR_SESSION_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function consumePendingProductTour(): boolean {
  try {
    const pending = sessionStorage.getItem(PENDING_TOUR_SESSION_KEY) === '1'
    if (pending) sessionStorage.removeItem(PENDING_TOUR_SESSION_KEY)
    return pending
  } catch {
    return false
  }
}
