import type { NavigateFunction } from 'react-router-dom'
import type { TradeStoreValue } from '../store/TradeStore'
import { getLiftTankers } from './liftTankers'
import { formatLiftOrderSummary } from './liftAllocations'
import { formatQty } from './utils'
import { formatLiftRef, formatOrderRef, formatPoRef } from './tradeRefs'
import { appPath } from './appShellMode'

export interface GlobalSearchItem {
  id: string
  label: string
  description?: string
  group: string
  action: () => void
}

export function buildGlobalSearchItems(store: TradeStoreValue, navigate: NavigateFunction): GlobalSearchItem[] {
  const items: GlobalSearchItem[] = []

  for (const o of store.getPORegister()) {
    items.push({
      id: `po-${o.id}`,
      label: formatOrderRef(o.ref, o.side),
      description: `PO · ${o.partyName} · ${o.itemName}`,
      group: 'Purchase Orders',
      action: () => navigate(appPath(`/purchase-orders?ref=${encodeURIComponent(o.ref)}`)),
    })
  }

  for (const o of store.getSORegister()) {
    items.push({
      id: `so-${o.id}`,
      label: formatOrderRef(o.ref, o.side),
      description: `SO · ${o.partyName} · ${o.itemName}${o.poRef ? ` · ${formatPoRef(o.poRef)}` : ''}`,
      group: 'Sales Orders',
      action: () => navigate(appPath(`/sales-orders?ref=${encodeURIComponent(o.ref)}`)),
    })
  }

  for (const l of store.lifts) {
    items.push({
      id: `lift-${l.id}`,
      label: formatLiftRef(l.liftRef),
      description: `${formatLiftOrderSummary(l)} · ${formatQty(l.liftedQty)}`,
      group: 'Lifts',
      action: () => navigate(appPath(`/lifts?party=${encodeURIComponent(l.buyerName)}`)),
    })
    for (const tanker of getLiftTankers(l)) {
      if (!tanker.tankerNo.trim()) continue
      items.push({
        id: `tanker-${l.id}-${tanker.tankerNo}`,
        label: tanker.tankerNo.toUpperCase(),
        description: `Tanker · ${formatLiftRef(l.liftRef)}${tanker.transportName ? ` · ${tanker.transportName}` : ''}`,
        group: 'Lifts',
        action: () => navigate(appPath(`/lifts?q=${encodeURIComponent(tanker.tankerNo)}`)),
      })
    }
  }

  for (const lot of store.lots) {
    items.push({
      id: `lot-${lot.id}`,
      label: lot.lotNumber,
      description: `${lot.commodity} · ${lot.producer}`,
      group: 'Inventory',
      action: () => navigate(appPath(`/inventory/${lot.id}`)),
    })
  }

  const parties = new Set<string>()
  for (const p of store.producers) parties.add(p.name)
  for (const r of store.retailers) parties.add(r.name)
  for (const b of store.brokers) parties.add(b.name)

  for (const name of [...parties].sort()) {
    items.push({
      id: `party-${name}`,
      label: name,
      description: 'Directory · view all transactions',
      group: 'Parties',
      action: () => navigate(appPath(`/party?name=${encodeURIComponent(name)}`)),
    })
  }

  return items
}
