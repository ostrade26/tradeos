import type { TradeOrder } from '../../data/mockData'
import { toBeLifted } from '../../data/mockData'
import type { TradeStoreValue } from '../../store/TradeStore'
import {
  dateRangeDaysBack,
  earningsFromLifts,
  liftsInDateRange,
  partyBalance,
  salesTotalFromLifts,
  todayDateStr,
} from '../finance/tradeFinance'
import { formatDateFilterLabel } from '../orderFilters'
import { formatCurrency, formatQty } from '../utils'
import { formatContractRate } from '../orderRate'
import { collectPartyNames, partyMatches, resolvePartyName } from './partyMatch'
import { parseCreateCommand, createCommandResult } from './createIntent'
import type { AssistantAction, AssistantResult } from './types'

function enc(value: string) {
  return encodeURIComponent(value)
}

function extractPartyFromQuery(raw: string): string | null {
  const patterns = [
    /(?:show|list|find|get|give)\s+(?:me\s+)?(?:all\s+)?(?:the\s+)?(?:transactions?|deals?|orders?|business|history)\s+(?:that\s+(?:i|we)\s+(?:have\s+)?(?:done\s+)?(?:with|for|from|to)\s+)(.+)/i,
    /(?:transactions?|deals?|orders?|business)\s+(?:with|for|from|to)\s+(.+)/i,
    /(?:with|for|from|to)\s+(.+?)(?:\s*$|\?)/i,
    /(.+?)\s+(?:transactions?|deals?|orders?)$/i,
  ]
  for (const pattern of patterns) {
    const m = raw.match(pattern)
    if (m?.[1]) return m[1].trim().replace(/\?$/, '')
  }
  return null
}

function extractItemFromQuery(raw: string): string | null {
  const patterns = [
    /(?:orders?|pos?|sos?|deals?)\s+(?:for|of|on)\s+(.+)/i,
    /(?:show|list)\s+(?:all\s+)?(.+?)\s+(?:orders?|pos?|sos?)/i,
  ]
  for (const pattern of patterns) {
    const m = raw.match(pattern)
    if (m?.[1]) return m[1].trim()
  }
  return null
}

function extractDaysFromQuery(q: string): number | null {
  const m = q.match(/\blast\s+(\d+)\s+days?\b/i)
  if (m) return parseInt(m[1], 10)
  return null
}

function extractPartyFromPaymentQuery(raw: string): { party: string; direction: 'payable' | 'receivable' } | null {
  const patterns: { re: RegExp; direction: 'payable' | 'receivable'; group: number }[] = [
    { re: /\b(?:how much\s+)?(?:do\s+)?i\s+(?:need\s+to\s+)?pay\s+(?:to\s+)?(.+?)\??$/i, direction: 'payable', group: 1 },
    { re: /\b(?:how much\s+)?(?:do\s+)?i\s+owe\s+(?:to\s+)?(.+?)\??$/i, direction: 'payable', group: 1 },
    { re: /\bpayable\s+(?:to\s+)?(.+?)\??$/i, direction: 'payable', group: 1 },
    { re: /\boutstanding\s+(?:payment\s+)?(?:to\s+)?(.+?)\??$/i, direction: 'payable', group: 1 },
    { re: /\bhow much\s+(?:does\s+)?(.+?)\s+(?:need\s+to\s+)?pay\s+(?:me|us)\??$/i, direction: 'receivable', group: 1 },
    { re: /\bhow much\s+(?:does\s+)?(.+?)\s+owe\s+(?:me|us)\??$/i, direction: 'receivable', group: 1 },
    { re: /\breceivable\s+(?:from\s+)?(.+?)\??$/i, direction: 'receivable', group: 1 },
    { re: /^(.+?)\s+(?:needs?\s+to\s+)?pay\s+(?:me|us)\??$/i, direction: 'receivable', group: 1 },
  ]

  for (const { re, direction, group } of patterns) {
    const m = raw.trim().match(re)
    if (m?.[group]) {
      const party = m[group].trim().replace(/\?+$/, '')
      if (party && !/^(how much|what|i|we)$/i.test(party)) {
        return { party, direction }
      }
    }
  }
  return null
}

function earningsResult(store: TradeStoreValue, from: string, to: string, label: string): AssistantResult {
  const lifts = liftsInDateRange(store.lifts, from, to)
  const summary = earningsFromLifts(store, lifts)

  if (summary.liftCount === 0) {
    return {
      message: `No lifts recorded for **${label}**, so earnings are **${formatCurrency(0)}**.`,
      actions: [{ label: 'Lift Register', path: '/lifts' }],
      navigateTo: '/lifts',
    }
  }

  return {
    message: [
      `**Earnings — ${label}**`,
      `- **${summary.liftCount}** lift${summary.liftCount === 1 ? '' : 's'} · ${formatQty(summary.qtyMt)} lifted`,
      `- Sales: **${formatCurrency(summary.sales)}**`,
      `- Purchase cost: **${formatCurrency(summary.purchase)}**`,
      `- **Margin (earning): ${formatCurrency(summary.margin)}**`,
    ].join('\n'),
    actions: [
      { label: 'View lifts', path: `/lifts`, count: summary.liftCount },
      { label: 'Analytics', path: '/analytics' },
    ],
    navigateTo: '/lifts',
  }
}

function salesResult(store: TradeStoreValue, from: string, to: string, label: string): AssistantResult {
  const lifts = liftsInDateRange(store.lifts, from, to)
  const total = salesTotalFromLifts(store, lifts)
  const qtyMt = lifts.reduce((s, l) => s + l.liftedQty, 0)

  return {
    message: [
      `**Total sales — ${label}**`,
      `- **${formatCurrency(total)}** from **${lifts.length}** lift${lifts.length === 1 ? '' : 's'}`,
      lifts.length > 0 ? `- ${formatQty(qtyMt)} lifted` : '- No lifts in this period',
    ].filter(Boolean).join('\n'),
    actions: [
      { label: 'Lift Register', path: '/lifts', count: lifts.length },
      { label: 'Sales Orders', path: '/sales-orders?view=completed' },
    ],
    navigateTo: '/lifts',
  }
}

function partyPayableResult(store: TradeStoreValue, party: string): AssistantResult {
  const balance = partyBalance(store, party)

  if (balance.liftCountAsSeller === 0 && balance.liftCountAsBuyer === 0) {
    return {
      message: `I couldn't find lifted business with **${party}** to calculate a balance.`,
      actions: [{ label: 'Open Directory', path: `/directory?q=${enc(party)}` }],
    }
  }

  const lines = [`**Payable to ${party}**`]
  if (balance.liftedPurchase > 0) {
    lines.push(`- Lifted purchases: **${formatCurrency(balance.liftedPurchase)}** (${balance.liftCountAsSeller} lift${balance.liftCountAsSeller === 1 ? '' : 's'})`)
    if (balance.paidOut > 0) lines.push(`- Already paid: **${formatCurrency(balance.paidOut)}**`)
    lines.push(`- **Balance due: ${formatCurrency(balance.payable)}**`)
  } else {
    lines.push(`- No purchase lifts with **${party}** as seller.`)
  }

  if (balance.receivable > 0) {
    lines.push(`- They also owe you **${formatCurrency(balance.receivable)}** on sales lifts.`)
  }

  return {
    message: lines.join('\n'),
    actions: [
      { label: 'Purchase Orders', path: `/purchase-orders?view=completed&party=${enc(party)}` },
      { label: 'Lifts', path: `/lifts?party=${enc(party)}`, count: balance.liftCountAsSeller + balance.liftCountAsBuyer },
    ],
    navigateTo: `/purchase-orders?view=completed&party=${enc(party)}`,
  }
}

function partyReceivableResult(store: TradeStoreValue, party: string): AssistantResult {
  const balance = partyBalance(store, party)

  if (balance.liftCountAsSeller === 0 && balance.liftCountAsBuyer === 0) {
    return {
      message: `I couldn't find lifted business with **${party}** to calculate a balance.`,
      actions: [{ label: 'Open Directory', path: `/directory?q=${enc(party)}` }],
    }
  }

  if (balance.receivable === 0 && balance.payable > 0) {
    return {
      message: [
        `**${party}** is mainly a **seller** in your books — nothing outstanding on sales to them.`,
        `- Your payable to them: **${formatCurrency(balance.payable)}**`,
        balance.paidOut > 0 ? `- (${formatCurrency(balance.paidOut)} already paid on lifted POs)` : '',
      ].filter(Boolean).join('\n'),
      actions: [
        { label: 'Payable detail', path: `/purchase-orders?view=completed&party=${enc(party)}` },
        { label: 'Party page', path: `/party?name=${enc(party)}` },
      ],
      navigateTo: `/party?name=${enc(party)}`,
    }
  }

  const lines = [`**Receivable from ${party}**`]
  if (balance.liftedSales > 0) {
    lines.push(`- Lifted sales: **${formatCurrency(balance.liftedSales)}** (${balance.liftCountAsBuyer} lift${balance.liftCountAsBuyer === 1 ? '' : 's'})`)
    if (balance.received > 0) lines.push(`- Already received: **${formatCurrency(balance.received)}**`)
    lines.push(`- **Balance due: ${formatCurrency(balance.receivable)}**`)
  } else {
    lines.push(`- No sales lifts to **${party}** as buyer.`)
  }

  return {
    message: lines.join('\n'),
    actions: [
      { label: 'Sales Orders', path: `/sales-orders?view=completed&party=${enc(party)}` },
      { label: 'Lifts', path: `/lifts?party=${enc(party)}`, count: balance.liftCountAsBuyer },
    ],
    navigateTo: `/sales-orders?view=completed&party=${enc(party)}`,
  }
}
function partyTransactionResult(store: TradeStoreValue, party: string): AssistantResult {
  const pos = store.getPORegister().filter(o =>
    partyMatches(o.partyName, party) ||
    partyMatches(o.sellerName ?? '', party),
  )
  const sos = store.getSORegister().filter(o =>
    partyMatches(o.partyName, party) ||
    partyMatches(o.buyerName ?? '', party),
  )
  const lifts = store.lifts.filter(l =>
    partyMatches(l.buyerName, party) || partyMatches(l.sellerName, party),
  )
  const lots = store.lots.filter(l => partyMatches(l.producer, party))
  const total = pos.length + sos.length + lifts.length

  if (total === 0 && lots.length === 0) {
    return {
      message: `I couldn't find any transactions with **${party}**. Try checking the spelling or add a PO/SO with this party first.`,
      actions: [
        { label: 'Open Directory', path: `/directory?q=${enc(party)}` },
        { label: 'All Purchase Orders', path: '/purchase-orders?view=completed' },
      ],
    }
  }

  const pendingPoQty = pos.filter(o => o.status !== 'completed').reduce((s, o) => s + toBeLifted(o), 0)
  const pendingSoQty = sos.filter(o => o.status !== 'completed').reduce((s, o) => s + toBeLifted(o), 0)
  const liftedQty = lifts.reduce((s, l) => s + l.liftedQty, 0)

  const lines = [
    `Here's everything I found for **${party}**:`,
    `- **${pos.length}** purchase order${pos.length === 1 ? '' : 's'}${pendingPoQty > 0 ? ` (${formatQty(pendingPoQty)} pending lift)` : ''}`,
    `- **${sos.length}** sales order${sos.length === 1 ? '' : 's'}${pendingSoQty > 0 ? ` (${formatQty(pendingSoQty)} pending lift)` : ''}`,
    `- **${lifts.length}** lift${lifts.length === 1 ? '' : 's'}${liftedQty > 0 ? ` (${formatQty(liftedQty)} lifted)` : ''}`,
  ]
  if (lots.length > 0) {
    lines.push(`- **${lots.length}** inventory lot${lots.length === 1 ? '' : 's'}`)
  }

  const actions: AssistantAction[] = []
  if (pos.length > 0) {
    actions.push({
      label: `Purchase Orders (${pos.length})`,
      path: `/purchase-orders?view=completed&party=${enc(party)}`,
      count: pos.length,
    })
  }
  if (sos.length > 0) {
    actions.push({
      label: `Sales Orders (${sos.length})`,
      path: `/sales-orders?view=completed&party=${enc(party)}`,
      count: sos.length,
    })
  }
  if (lifts.length > 0) {
    actions.push({
      label: `Lifts (${lifts.length})`,
      path: `/lifts?party=${enc(party)}`,
      count: lifts.length,
    })
  }
  if (lots.length > 0) {
    actions.push({
      label: `Inventory (${lots.length})`,
      path: `/inventory?q=${enc(party)}`,
      count: lots.length,
    })
  }

  const navigateTo = actions[0]?.path

  return {
    message: lines.join('\n'),
    actions,
    navigateTo,
  }
}

function orderRefResult(order: TradeOrder | undefined, side: 'purchase' | 'sale', ref: string): AssistantResult {
  const pathPrefix = side === 'purchase' ? '/purchase-orders' : '/sales-orders'
  const label = side === 'purchase' ? 'PO' : 'SO'
  if (!order) {
    return {
      message: `${label} **${ref}** was not found in your register.`,
      actions: [{ label: `All ${label}s`, path: `${pathPrefix}?view=completed` }],
    }
  }
  const pending = toBeLifted(order)
  return {
    message: [
      `**${order.ref}** — ${order.itemName}`,
      `- ${side === 'purchase' ? 'Seller' : 'Buyer'}: ${order.partyName}`,
      `- Qty: ${formatQty(order.orderQty)} · Lifted: ${formatQty(order.liftedQty)} · Pending: ${formatQty(pending)}`,
      `- Rate: ${formatContractRate(order.rate)}`,
    ].join('\n'),
    actions: [{ label: `Open ${ref}`, path: `${pathPrefix}?ref=${enc(ref)}` }],
    navigateTo: `${pathPrefix}?ref=${enc(ref)}`,
  }
}

function helpResult(): AssistantResult {
  return {
    message: [
      'I can help you explore Tradeal. Try asking:',
      '',
      '• *What is today\'s earning?*',
      '• *Total sales in last 3 days*',
      '• *How much do I need to pay DVC?*',
      '• *How much does Haldiram owe me?*',
      '• *Show all transactions with DVC Process Tech*',
      '• *Pending purchase orders*',
      '• *Show PO-3* or *SO-2*',
      '• *Lifts for Patanjali*',
      '• *Low inventory lots*',
      '• *Orders for Palm Oil*',
      '• *Summary / stats*',
      '• *Create a PO for DVC 50 MT soyabean oil*',
      '• *New sales order for Girija against PO-1*',
      '• *Record lift for PO-1 SO-1*',
    ].join('\n'),
    actions: [
      { label: 'Dashboard', path: '/app' },
      { label: 'Purchase Orders', path: '/purchase-orders' },
      { label: 'Sales Orders', path: '/sales-orders' },
      { label: 'Lift Register', path: '/lifts' },
      { label: 'Inventory', path: '/inventory' },
    ],
  }
}

function statsResult(store: TradeStoreValue): AssistantResult {
  const poPending = store.getPOPending()
  const soPending = store.getSOPending()
  const inventoryValue = store.lots.reduce((s, l) => s + l.remaining * l.purchasePrice, 0)
  const lowStock = store.lots.filter(l => l.available < 20)

  return {
    message: [
      '**Tradeal snapshot**',
      `- **${poPending.length}** POs pending · ${formatQty(poPending.reduce((s, o) => s + toBeLifted(o), 0))} to lift`,
      `- **${soPending.length}** SOs pending · ${formatQty(soPending.reduce((s, o) => s + toBeLifted(o), 0))} to lift`,
      `- **${store.lifts.length}** lifts recorded`,
      `- **${store.lots.length}** inventory lots · ${formatCurrency(inventoryValue)} value`,
      lowStock.length > 0 ? `- **${lowStock.length}** low-stock alert${lowStock.length === 1 ? '' : 's'}` : '',
    ].filter(Boolean).join('\n'),
    actions: [
      { label: 'Dashboard', path: '/app' },
      ...(lowStock.length > 0 ? [{ label: 'Low inventory', path: '/inventory?lowStock=true' }] : []),
      { label: 'Pending POs', path: '/purchase-orders' },
      { label: 'Pending SOs', path: '/sales-orders' },
    ],
    navigateTo: '/',
  }
}

export function runAssistantQuery(query: string, store: TradeStoreValue): AssistantResult {
  const raw = query.trim()
  const q = raw.toLowerCase()
  if (!raw) {
    return { message: 'Ask me anything about your POs, SOs, lifts, or inventory.', actions: [] }
  }

  const parties = collectPartyNames(store)

  const createDraft = parseCreateCommand(raw, store)
  if (createDraft) {
    return createCommandResult(createDraft)
  }

  if (/^(help|what can you|how do i|commands?)\b/.test(q)) {
    return helpResult()
  }

  if (/\b(summary|stats|overview|snapshot|dashboard)\b/.test(q)) {
    return statsResult(store)
  }

  const paymentQuery = extractPartyFromPaymentQuery(raw)
  if (paymentQuery) {
    const party = resolvePartyName(paymentQuery.party, parties) ?? paymentQuery.party
    return paymentQuery.direction === 'payable'
      ? partyPayableResult(store, party)
      : partyReceivableResult(store, party)
  }

  if (/\b(today'?s?|todays)\s+(earning|earnings|profit|margin)\b/.test(q)
    || /\b(earning|earnings|profit|margin)\s+(today|for today)\b/.test(q)) {
    const today = todayDateStr()
    return earningsResult(store, today, today, 'today')
  }

  const days = extractDaysFromQuery(q)
  if (days && /\bsales\b/.test(q)) {
    const range = dateRangeDaysBack(days)
    const label = formatDateFilterLabel(range.from, range.to)
    return salesResult(store, range.from, range.to, `last ${days} days (${label})`)
  }

  if (/\bsales\s+today\b/.test(q)) {
    const today = todayDateStr()
    return salesResult(store, today, today, 'today')
  }

  if (days && /\b(earning|earnings|profit|margin)\b/.test(q)) {
    const range = dateRangeDaysBack(days)
    const label = formatDateFilterLabel(range.from, range.to)
    return earningsResult(store, range.from, range.to, `last ${days} days (${label})`)
  }

  const poRef = raw.match(/\bpo[-\s]?(\d+)\b/i)
  if (poRef) {
    const ref = `PO-${poRef[1]}`
    return orderRefResult(store.getOrderByRef(ref, 'purchase'), 'purchase', ref)
  }

  const soRef = raw.match(/\bso[-\s]?(\d+)\b/i)
  if (soRef) {
    const ref = `SO-${soRef[1]}`
    return orderRefResult(store.getOrderByRef(ref, 'sale'), 'sale', ref)
  }

  if (/\b(low\s+stock|low\s+inventory|running\s+out)\b/.test(q)) {
    const low = store.lots.filter(l => l.available < 20)
    return {
      message: low.length > 0
        ? `**${low.length}** lot${low.length === 1 ? '' : 's'} below 20 MT available.`
        : 'No low-stock lots right now — all inventory looks healthy.',
      actions: [{ label: 'View inventory', path: '/inventory?lowStock=true', count: low.length }],
      navigateTo: '/inventory?lowStock=true',
    }
  }

  if (/\bpending\s+(po|purchase)/.test(q) || /\b(open|pending)\s+purchase/.test(q)) {
    const pending = store.getPOPending()
    return {
      message: `**${pending.length}** pending purchase order${pending.length === 1 ? '' : 's'} · ${formatQty(pending.reduce((s, o) => s + toBeLifted(o), 0))} to lift.`,
      actions: [{ label: 'View pending POs', path: '/purchase-orders', count: pending.length }],
      navigateTo: '/purchase-orders',
    }
  }

  if (/\bpending\s+(so|sales)/.test(q) || /\b(open|pending)\s+sales/.test(q)) {
    const pending = store.getSOPending()
    return {
      message: `**${pending.length}** pending sales order${pending.length === 1 ? '' : 's'} · ${formatQty(pending.reduce((s, o) => s + toBeLifted(o), 0))} to lift.`,
      actions: [{ label: 'View pending SOs', path: '/sales-orders', count: pending.length }],
      navigateTo: '/sales-orders',
    }
  }

  if (/\b(lift|lifts|lifted|lifting)\b/.test(q)) {
    const partyHint = extractPartyFromQuery(raw)
    const party = partyHint ? resolvePartyName(partyHint, parties) : null
    if (party) {
      const lifts = store.lifts.filter(l => partyMatches(l.buyerName, party) || partyMatches(l.sellerName, party))
      return {
        message: `**${lifts.length}** lift${lifts.length === 1 ? '' : 's'} involving **${party}**.`,
        actions: [{ label: 'View lifts', path: `/lifts?party=${enc(party)}`, count: lifts.length }],
        navigateTo: `/lifts?party=${enc(party)}`,
      }
    }
    return {
      message: `**${store.lifts.length}** lifts in your register.`,
      actions: [{ label: 'Lift Register', path: '/lifts', count: store.lifts.length }],
      navigateTo: '/lifts',
    }
  }

  if (/\b(inventory|lots?|stock)\b/.test(q)) {
    const itemHint = extractItemFromQuery(raw)
    if (itemHint) {
      const lots = store.lots.filter(l => partyMatches(l.commodity, itemHint) || partyMatches(l.producer, itemHint))
      return {
        message: `**${lots.length}** inventory lot${lots.length === 1 ? '' : 's'} matching **${itemHint}**.`,
        actions: [{ label: 'View inventory', path: `/inventory?q=${enc(itemHint)}`, count: lots.length }],
        navigateTo: `/inventory?q=${enc(itemHint)}`,
      }
    }
    return {
      message: `**${store.lots.length}** inventory lots · ${formatCurrency(store.lots.reduce((s, l) => s + l.remaining * l.purchasePrice, 0))} total value.`,
      actions: [{ label: 'View inventory', path: '/inventory' }],
      navigateTo: '/inventory',
    }
  }

  if (/\b(purchase\s+order|purchase\s+orders|\bpos?\b)/.test(q) && !/\bsales|\bso\b/.test(q)) {
    const partyHint = extractPartyFromQuery(raw) ?? extractItemFromQuery(raw)
    const party = partyHint ? resolvePartyName(partyHint, parties) : null
    if (party) {
      return partyTransactionResult(store, party)
    }
    return {
      message: `**${store.getPOCompleted().length}** completed purchase orders · **${store.getPOPending().length}** ongoing.`,
      actions: [
        { label: 'Pending POs', path: '/purchase-orders' },
        { label: 'Completed POs', path: '/purchase-orders?view=completed' },
      ],
      navigateTo: '/purchase-orders?view=completed',
    }
  }

  if (/\b(sales\s+order|sales\s+orders|\bsos?\b)/.test(q)) {
    const partyHint = extractPartyFromQuery(raw)
    const party = partyHint ? resolvePartyName(partyHint, parties) : null
    if (party) {
      return partyTransactionResult(store, party)
    }
    return {
      message: `**${store.getSOCompleted().length}** completed sales orders · **${store.getSOPending().length}** ongoing.`,
      actions: [
        { label: 'Pending SOs', path: '/sales-orders' },
        { label: 'Completed SOs', path: '/sales-orders?view=completed' },
      ],
      navigateTo: '/sales-orders?view=completed',
    }
  }

  const itemHint = extractItemFromQuery(raw)
  if (itemHint) {
    const pos = store.getPORegister().filter(o => partyMatches(o.itemName, itemHint))
    const sos = store.getSORegister().filter(o => partyMatches(o.itemName, itemHint))
    if (pos.length + sos.length > 0) {
      return {
        message: `Orders for **${itemHint}**: **${pos.length}** POs · **${sos.length}** SOs.`,
        actions: [
          ...(pos.length > 0 ? [{ label: `POs (${pos.length})`, path: `/purchase-orders?view=completed&q=${enc(itemHint)}`, count: pos.length }] : []),
          ...(sos.length > 0 ? [{ label: `SOs (${sos.length})`, path: `/sales-orders?view=completed&q=${enc(itemHint)}`, count: sos.length }] : []),
        ],
        navigateTo: pos.length > 0
          ? `/purchase-orders?view=completed&q=${enc(itemHint)}`
          : `/sales-orders?view=completed&q=${enc(itemHint)}`,
      }
    }
  }

  const partyHint = extractPartyFromQuery(raw)
  if (partyHint) {
    const party = resolvePartyName(partyHint, parties) ?? partyHint
    return partyTransactionResult(store, party)
  }

  if (/\b(transactions?|deals?|orders?|business|history)\b/.test(q)) {
    const party = resolvePartyName(raw.replace(/\b(show|all|me|the|my|find|list|get)\b/gi, '').trim(), parties)
    if (party) return partyTransactionResult(store, party)
  }

  const directParty = resolvePartyName(raw, parties)
  if (directParty) {
    return partyTransactionResult(store, directParty)
  }

  return {
    message: [
      `I'm not sure how to answer "${raw}".`,
      '',
      'Try: *Today\'s earning*, *Total sales in last 3 days*, *How much to pay DVC?*, *Pending POs*, or type **help**.',
    ].join('\n'),
    actions: [{ label: 'Help', path: '' }],
  }
}
