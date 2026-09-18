import { CURRENT_TRADER, CURRENT_TRADER_LOCATION, type Company } from '../data/mockData'
import { normalizeCompanyName } from './companyResolution'

/**
 * Account party name for POs/SOs.
 * Prefer the signed-in organisation. "Shri Kubera Traders" is only a sandbox/demo fallback.
 */
export function getAccountTraderName(organisationName?: string | null): string {
  const fromOrg = (organisationName ?? '').trim()
  if (fromOrg) return fromOrg
  return CURRENT_TRADER
}

export function getAccountTraderLocation(organisationLocation?: string | null): string {
  const fromOrg = (organisationLocation ?? '').trim()
  if (fromOrg) return fromOrg
  return CURRENT_TRADER_LOCATION
}

/** Logged-in trader — buyer on POs, seller on SOs */
export function findAccountCompany(
  companies: Company[],
  organisationName?: string | null,
): Company {
  const trader = getAccountTraderName(organisationName)
  const match = companies.find(
    c => normalizeCompanyName(c.officialName) === normalizeCompanyName(trader),
  )
  if (match) return match

  return {
    id: '',
    officialName: trader,
    aliases: [],
    types: ['buyer', 'seller'],
    location: getAccountTraderLocation(),
  }
}

/** @deprecated Use findAccountCompany */
export const findAccountBuyerCompany = findAccountCompany

export function isAccountPartyName(name: string, organisationName?: string | null): boolean {
  const norm = normalizeCompanyName(name)
  if (!norm) return false
  const trader = getAccountTraderName(organisationName)
  if (norm === normalizeCompanyName(trader)) return true
  // Legacy sandbox demo alias
  if (/\bkubera\b/.test(norm) && (/\bshri\b/.test(norm) || /\bsri\b/.test(norm))) return true
  return false
}

/** Confirmed-by is a person name — not the logged-in account */
export function displayPartyConfirmedBy(name: string, organisationName?: string | null): string {
  const trimmed = name.trim()
  if (!trimmed || isAccountPartyName(trimmed, organisationName)) return ''
  return trimmed
}

export function accountBuyerFormFields(
  companies: Company[],
  organisationName?: string | null,
): Record<string, string> {
  const account = findAccountCompany(companies, organisationName)
  return {
    buyerName: getAccountTraderName(organisationName),
    buyerCompanyId: account.id,
  }
}

export function accountSellerFormFields(
  companies: Company[],
  organisationName?: string | null,
): Record<string, string> {
  const account = findAccountCompany(companies, organisationName)
  return {
    sellerName: getAccountTraderName(organisationName),
    sellerCompanyId: account.id,
  }
}

export function lockedAccountPartyFields(
  side: 'purchase' | 'sale',
  companies: Company[],
  organisationName?: string | null,
): Record<string, string> {
  return side === 'purchase'
    ? accountBuyerFormFields(companies, organisationName)
    : accountSellerFormFields(companies, organisationName)
}

export { CURRENT_TRADER, CURRENT_TRADER_LOCATION }
