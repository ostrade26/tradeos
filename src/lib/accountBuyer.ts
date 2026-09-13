import { CURRENT_TRADER, CURRENT_TRADER_LOCATION, type Company } from '../data/mockData'
import { normalizeCompanyName } from './companyResolution'

/** Logged-in trader — buyer on POs, seller on SOs */
export function findAccountCompany(companies: Company[]): Company {
  const match = companies.find(
    c => normalizeCompanyName(c.officialName) === normalizeCompanyName(CURRENT_TRADER),
  )
  if (match) return match

  return {
    id: '',
    officialName: CURRENT_TRADER,
    aliases: [],
    types: ['buyer', 'seller'],
    location: CURRENT_TRADER_LOCATION,
  }
}

/** @deprecated Use findAccountCompany */
export const findAccountBuyerCompany = findAccountCompany

export function isAccountPartyName(name: string): boolean {
  const norm = normalizeCompanyName(name)
  if (!norm) return false
  if (norm === normalizeCompanyName(CURRENT_TRADER)) return true
  if (/\bkubera\b/.test(norm) && (/\bshri\b/.test(norm) || /\bsri\b/.test(norm))) return true
  return false
}

/** Confirmed-by is a person name — not the logged-in account */
export function displayPartyConfirmedBy(name: string): string {
  const trimmed = name.trim()
  if (!trimmed || isAccountPartyName(trimmed)) return ''
  return trimmed
}

export function accountBuyerFormFields(companies: Company[]): Record<string, string> {
  const account = findAccountCompany(companies)
  return {
    buyerName: CURRENT_TRADER,
    buyerCompanyId: account.id,
  }
}

export function accountSellerFormFields(companies: Company[]): Record<string, string> {
  const account = findAccountCompany(companies)
  return {
    sellerName: CURRENT_TRADER,
    sellerCompanyId: account.id,
  }
}

export function lockedAccountPartyFields(
  side: 'purchase' | 'sale',
  companies: Company[],
): Record<string, string> {
  return side === 'purchase'
    ? accountBuyerFormFields(companies)
    : accountSellerFormFields(companies)
}

export { CURRENT_TRADER, CURRENT_TRADER_LOCATION }
