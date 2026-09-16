# Tradeal UX Audit — Full Report
**App:** Tradeal (commodity trading) · `http://localhost:5173/`  
**Code:** `/Users/rahulpatil/Projects/tradeal`  
**Date:** 9 Sep 2026  
**Methods:** Live UI screenshots (desktop + mobile) + source review on your Mac

---

## Executive summary

Tradeal is a strong ops shell for oil/commodity traders: clear Trading vs Platform nav, action-oriented dashboard, solid empty states, PDF contract import on PO entry, and thoughtful mobile card layouts. The biggest gaps are **mental-model mismatches** (inbox “lift pending” vs Lift Register Pending), **post-create drop-off**, **mobile truncation / desktop shortcuts on phone**, and **terminology consistency** — not a missing product foundation.

### Top 10 (prioritized)

| # | Sev | Area | Issue | Fix |
|---|-----|------|-------|-----|
| 1 | **High** | Flows / IA | Action Inbox “Lift PO-* pending” means *unlifted PO balance*; Lift Register **Pending** means *in-transit lifts*. Same word, two concepts. Deep-link correctly goes to `/lifts/new?poRef=…` (not a dead end). | Relabel inbox to “Ready to lift / Unlifted” vs “In transit”; glossary tip on first visit |
| 2 | **High** | Flows | After Create PO: toast + return to register — no “Record lift / View / Create another” | Post-save action sheet |
| 3 | **High** | IA | Contracts live under Platform while PO Entry leads with “Import from Contract PDF” | Move Contracts into Trading or dual-link from PO Entry |
| 4 | **High** | IA | Three attention systems: Action Inbox (14), bell badge, Activity | Make Inbox canonical; sync or explain bell vs inbox |
| 5 | **High** | Mobile | KPI lines, status “Pen…”, PDF helper truncated mid-sentence | Wrap / full `aria-label`; no ellipsis on critical status |
| 6 | **High** | Mobile / Copy | `⌘S to save` shown on mobile New PO | Hide shortcuts below `md`; point to sticky bar |
| 7 | **High** | Copy | PO / Purchase Order / Lift / MT / Spot used inconsistently | Product glossary; spell out once per page |
| 8 | **Med** | Usability | Register chrome (KPIs + 6–7 filters) buries list on mobile | Collapse KPIs; filters sheet (PO already does this — match on Lifts) |
| 9 | **Med** | A11y | Muted `#6c757d` / warning chips / amber metrics — spot-check AA in dark + light | Token audit; darken muted; stronger chip text |
| 10 | **Med** | Findability | “Avail. to sell” on PO cards; sell path exists on **Lot details** (`Sell from this lot`) but not obvious from PO register | Row/drawer action “Sell available” → SO or lot sell |

### Already in good shape (don’t regress)

- FAB speed-dial: New PO / New SO / Record Lift; hides on `/new` and `/edit`; has `aria-label`s  
- Header icon buttons: Open menu, Ask AI, Settings, Toggle theme labeled  
- Drawers & command palette: `useFocusTrap`; toasts: `aria-live`  
- Inline party/item/broker create via `SearchableSelect.onCreate` on order entry  
- Lift Register empty state copy is best-in-app  
- Mobile PO list as cards; sticky Cancel / Create PO on entry  
- Sell from lot + Create SO against PO on lot detail; inventory tracks over-allocation  

---

## 1. Usability

**Strengths:** Dashboard “Today” + Action Inbox is the right home for traders. PO Entry shows last register entry + live tax/total summary. Lift empty state teaches when to record vs mark delivered. Keyboard: `⌘K`, F1/F3/F5 for new PO/SO/lift.

**Issues**

| Sev | Finding | Evidence | Rec |
|-----|---------|----------|-----|
| High | No guided next step after create | `OrderEntryPage` → toast + `navigate(registerHref)` | Success sheet: Record lift · View order · Create another |
| Med | Dense always-on filters on desktop registers | PO/Lift screenshots | Chip bar + “More filters”; persist last set |
| Med | PO Entry: commercial fields below fold; Seller empty shows “—” | `desktop-po-new.png` | Stepper or section nav; “Select seller” CTA (create-inline already works) |
| Med | Dual create: page `+ New PO` and FAB | Intentional; OK on desktop | On mobile prefer one primary |
| Low | Dirty-form cancel confirm | Needs product confirmation if missing | Guard Cancel when form dirty |

---

## 2. Information Architecture

```
TRADING: Dashboard · Purchase Orders · Sales Orders · Lift Register · Inventory
PLATFORM: Directory · Analytics · Activity · Contracts
```

Redirects (source `App.tsx`): `payments`→`/`, `market-news`→`/`, `deliveries`→`/lifts`, `brokers`→directory brokers tab, pending/register aliases → query views. Catch-all → `/`.

| Sev | Finding | Rec |
|-----|---------|-----|
| High | Contracts under Platform vs PDF import on PO | Put Contracts in Trading or link “Save as contract” from import |
| High | Inbox vs bell vs Activity | One system of record; document badge math |
| Med | Soft orphans: Party, sell-lot, contract create only via secondary CTAs | Ensure global search + FAB/palette cover them |
| Low | Settings only in header gear | Optional Platform link |

---

## 3. User flows & funnels

### Create PO (7–10 steps)
Entry → optional PDF import → parties → refs → item/commercial → Create.  
**Drop-off:** post-save has no lift prompt (**High**).

### Create SO
Parallel entry; lot detail offers Create SO / Sell from lot.  
**Risk:** Avail. to sell on PO list doesn’t deep-link to sell (**Med–High** findability).

### Record / complete lift
Inbox → `/lifts/new?poRef=` (good). Register Pending = in-transit only.  
**Drop-off risk:** users opening Lift Register expecting inbox items see empty Pending (**High** labeling).

### Dashboard → act
Inbox items carry typed hrefs (`po_lift`, `so_lift`, `low_stock`, `delivery`, etc.) — solid.  
**Friction:** three different pending counts (**High**).

### Party / broker
Inline create on order entry — **confirmed**. Directory still needed for full edit.

### Search / create sprawl
`⌘K` + local register search + Ask AI + FAB — power-user friendly; document roles (**Med**).

---

## 4. Accessibility (WCAG-oriented)

| Sev | Finding | Evidence | Rec |
|-----|---------|----------|-----|
| Med–High | Contrast on muted / warning chips / amber “TO BE LIFTED” | `--color-muted: #6c757d`; warning `#f59e0b` | Token pass light+dark; aim 4.5:1 body |
| Med | Notification bell accessible name / count | Badge `9+` | `aria-label="Notifications, 9 or more"` |
| Med | Row `…` / checkbox hit areas | Dense tables | 44×44 targets |
| Low–Med | Truncation hides text from everyone incl. AT | Mobile KPIs / Pen… | Full text in accessible name or wrap |
| — | Focus trap + live regions present | `useFocusTrap`, toast `aria-live`, `.attex-focus` | Keep; add skip-to-main if missing |
| — | Many icon buttons already labeled | Header, FAB, Sidebar | Extend pattern to all row menus |

**Not run:** axe-core / Lighthouse against live Vite (recommended next).

---

## 5. Content & copy

| Sev | Finding | Rec |
|-----|---------|-----|
| High | Purchase Orders vs New PO vs PO Qty | Title full term; abbreviate in dense UI after first spell-out |
| High | Lift / lifted / to lift / delivered | Adopt empty-state glossary app-wide |
| Med | MT never expanded | “MT (metric tons)” once per view |
| Med | Spot unexplained in filters | Helper: delivery/loading location |
| Info | Lift empty state + PDF import desktop copy | Reuse tone elsewhere |

---

## 6. Mobile responsiveness

| Sev | Finding | Evidence | Rec |
|-----|---------|----------|-----|
| High | Truncated KPIs, status, PDF help | `mobile-*.png` | Wrap; `aria-label="Pending"` |
| High | ⌘S on phone | `mobile-po-new.png` | Hide &lt; md |
| Med | Header icon crowding | Mobile chrome | Overflow menu; 44px gaps |
| Med | FAB + header CTA | List pages | Pick one on small screens |
| Med | Lift filters likely still dense | Match PO Filters sheet | |
| Low | Safe-area on sticky actions | | `env(safe-area-inset-bottom)` |
| — | Sidebar drawer, card lists, sticky form actions | Good patterns | Extend |

---

## 7. Suggested fix order

1. Relabel Inbox vs Lift Pending + micro-glossary  
2. Post-create PO/SO success actions  
3. Mobile truncation + hide ⌘S  
4. Contracts placement / cross-links  
5. Unify attention badges  
6. Contrast token pass + remaining a11y names  
7. “Sell available” from PO drawer/row  
8. axe + VoiceOver pass on key routes  

---

## Screenshot index
`/workspace/tradeal-audit/` — desktop-home, desktop-po, desktop-po-new, desktop-lifts, mobile-home, mobile-po, mobile-po-new
