import type { Company } from '../data/mockData'
import type { ParsedContractPdf } from './parseContractPdf'
import { contractToFormValues } from './parseContractPdf'
import {
  accountBuyerFormFields,
  accountSellerFormFields,
  displayPartyConfirmedBy,
  findAccountCompany,
} from './accountBuyer'
import { canonicalItemName, collectItemNames } from './itemResolution'

export interface ResolvedPdfParties {
  seller: Company
  buyer: Company
}

export interface ItemCatalogSources {
  items: string[]
  tradeOrders?: { itemName: string }[]
  lots?: { commodity: string }[]
}

export function buildPdfImportFormValues(
  parsed: ParsedContractPdf,
  side: 'purchase' | 'sale',
  resolved: ResolvedPdfParties,
  companies: Company[] = [],
  catalog?: ItemCatalogSources,
): Record<string, string> {
  const base = contractToFormValues(parsed, side)
  const { seller, buyer } = resolved
  const itemName = catalog
    ? canonicalItemName(parsed.itemName, collectItemNames(catalog))
    : parsed.itemName

  if (side === 'purchase') {
    const account = accountBuyerFormFields(companies)
    return {
      ...base,
      itemName,
      ...account,
      partyName: seller.officialName,
      sellerName: seller.officialName,
      partyCompanyId: seller.id,
      sellerCompanyId: seller.id,
      extractedSellerName: parsed.sellerName,
      extractedBuyerName: parsed.buyerName,
      extractedPartyName: parsed.sellerName,
      buyerGst: '',
      sellerConfirmedBy: displayPartyConfirmedBy(parsed.sellerConfirmedBy),
      buyerConfirmedBy: displayPartyConfirmedBy(parsed.buyerConfirmedBy),
      contractRateDisplay: parsed.rateDisplay,
    }
  }

  const account = accountSellerFormFields(companies)
  return {
    ...base,
    itemName,
    ...account,
    partyName: buyer.officialName,
    sellerName: account.sellerName,
    buyerName: buyer.officialName,
    partyCompanyId: buyer.id,
    sellerCompanyId: account.sellerCompanyId,
    buyerCompanyId: buyer.id,
    extractedSellerName: parsed.sellerName,
    extractedBuyerName: parsed.buyerName,
    extractedPartyName: parsed.buyerName,
    sellerConfirmedBy: displayPartyConfirmedBy(parsed.sellerConfirmedBy),
    buyerConfirmedBy: displayPartyConfirmedBy(parsed.buyerConfirmedBy),
    contractRateDisplay: parsed.rateDisplay,
  }
}

export { findAccountCompany, findAccountCompany as findAccountBuyerCompany }
