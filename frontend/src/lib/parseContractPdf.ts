import { parse, format } from 'date-fns'
import type { DeliveryType } from '../data/mockData'
import { CURRENT_TRADER, displayPartyConfirmedBy, isAccountPartyName } from './accountBuyer'
import {
  groupPositionedLines,
  parseBrokerFromHeadingLines,
  parseBrokerNameFromHeader,
  parseBrokerNameFromHeaderText,
} from './brokerNameExtraction'
import { formatIndianAmount } from './indianAmount'
import { getPdfJs } from './pdfjsClient'

export interface ParsedContractPdf {
  brokerContractRef: string
  contractDate: string
  sellerName: string
  sellerConfirmedBy: string
  buyerName: string
  buyerConfirmedBy: string
  itemName: string
  quantityMt: number
  ratePerMt: number
  ratePerBasis: number
  ratePerBasisFormatted: string
  rateBasis: string
  rateIncludesGst: boolean
  rateDisplay: string
  brand: string
  deliveryType: DeliveryType
  deliveryPeriodStart: string
  deliveryPeriodEnd: string
  paymentTerms: string
  remarks: string
  brokeragePerTon: number
  sellerGst: string
  buyerGst: string
  brokerName: string
}

function normalizeText(text: string): string {
  return text.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n +/g, '\n').trim()
}

function parseContractDate(raw: string): string {
  const trimmed = raw.trim()
  for (const pattern of ['dd-MM-yyyy', 'd-M-yyyy', 'dd/MM/yyyy']) {
    try {
      return format(parse(trimmed, pattern, new Date()), 'yyyy-MM-dd')
    } catch {
      // try next pattern
    }
  }
  return trimmed
}

function parseDeliveryDate(token: string, year: number): string {
  const match = token.trim().match(/^(\d{1,2})-([A-Za-z]{3})$/i)
  if (!match) return ''
  const monthMap: Record<string, string> = {
    JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
    JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
  }
  const month = monthMap[match[2].toUpperCase()]
  if (!month) return ''
  const day = match[1].padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isReadyDeliveryLine(line: string): boolean {
  return /^READY$/i.test(line.trim())
}

function buildRateDisplay(formatted: string, basis: string, includesGst: boolean): string {
  if (!formatted) return ''
  return `${formatted} ${basis}${includesGst ? ' + GST' : ''}`
}

function parseRate(raw: string): {
  ratePerMt: number
  ratePerBasis: number
  ratePerBasisFormatted: string
  rateBasis: string
  rateIncludesGst: boolean
  rateDisplay: string
  brand: string
} {
  const brandMatch = raw.match(/\(([^)]+)\)/)
  const brand = brandMatch?.[1]?.trim() ?? ''
  const includesGst = /\+\s*GST/i.test(raw)

  const per10Kg = raw.match(/([\d,]+(?:\.\d+)?)\s*PER\s*10\s*KG/i)
  if (per10Kg) {
    const per10 = parseFloat(per10Kg[1].replace(/,/g, ''))
    return {
      ratePerBasis: per10,
      ratePerBasisFormatted: per10Kg[1],
      rateBasis: 'PER 10 KG',
      rateIncludesGst: includesGst,
      rateDisplay: buildRateDisplay(per10Kg[1], 'PER 10 KG', includesGst),
      ratePerMt: per10 * 100,
      brand,
    }
  }

  const perTon = raw.match(/([\d,]+(?:\.\d+)?)\s*PER\s*(?:MT|TON)\b/i)
  if (perTon) {
    const perMt = parseFloat(perTon[1].replace(/,/g, ''))
    const per10 = perMt / 100
    const formatted10 = formatIndianAmount(per10)
    return {
      ratePerBasis: per10,
      ratePerBasisFormatted: formatted10,
      rateBasis: 'PER 10 KG',
      rateIncludesGst: includesGst,
      rateDisplay: buildRateDisplay(formatted10, 'PER 10 KG', includesGst),
      ratePerMt: perMt,
      brand,
    }
  }

  const generic = raw.match(/([\d,]+(?:\.\d+)?)/)
  const ratePerBasisFormatted = generic?.[1] ?? '0'
  const ratePerBasis = parseFloat(ratePerBasisFormatted.replace(/,/g, '')) || 0
  return {
    ratePerBasis,
    ratePerBasisFormatted,
    rateBasis: 'PER 10 KG',
    rateIncludesGst: includesGst,
    rateDisplay: buildRateDisplay(ratePerBasisFormatted, 'PER 10 KG', includesGst),
    ratePerMt: ratePerBasis * 100,
    brand,
  }
}

const COMPANY_HINT =
  /\b(pvt\.?|ltd\.?|llp|limited|industries|traders?|trader|enterprises?|oils?|mills?|foods?|corporation|company|agency|international|refinery|exports?|imports?|brothers|bros\.?|agro|products?|trading|inc\.?|llc|private|farm|farms)\b/i
const LEGAL_SUFFIX_START =
  /^(pvt\.?|ltd\.?|llp|limited|enterprises?|industries|inc\.?|llc|private)\b/i
const PERSON_PREFIX = /^(mr\.?|mrs\.?|ms\.?|shri|smt\.?)\s+/i
const LABEL_ONLY = /^(seller|buyer|confirmed\s*by|conf\.?\s*by)$/i

function stripPartyLabel(line: string): string {
  return line
    .replace(/^(seller|buyer)\s*[:\-]\s*/i, '')
    .replace(/^(confirmed\s*by|conf\.?\s*by)\s*[:\-]?\s*/i, '')
    .trim()
}

function looksLikeCompanyName(line: string): boolean {
  const name = stripPartyLabel(line)
  if (!name) return false
  if (/^(m\/s|messrs)\b/i.test(name)) return true
  if (/,\s*[A-Za-z]/.test(name)) return true
  if (COMPANY_HINT.test(name)) return true
  if (isAccountPartyName(name)) return true
  return false
}

/** Person who confirmed — not the trading company. */
export function isLikelyPersonName(line: string): boolean {
  const name = stripPartyLabel(line).replace(PERSON_PREFIX, '').trim()
  if (!name || looksLikeCompanyName(line)) return false
  if (/\d/.test(name)) return false
  const words = name.split(/\s+/).filter(Boolean)
  return words.length >= 1 && words.length <= 3 && name.length <= 40
}

function looksLikeCompleteCompany(line: string): boolean {
  const name = stripPartyLabel(line)
  if (!name || LEGAL_SUFFIX_START.test(name)) return false
  return looksLikeCompanyName(name)
}

function mergeBrokenLines(lines: string[]): string[] {
  const merged: string[] = []
  for (const line of lines) {
    const prev = merged[merged.length - 1]
    const suffixOrCommaWrap = line.startsWith(',') || LEGAL_SUFFIX_START.test(line)
    // Confirming-person lines sit between two companies. Do not glue them onto the next firm,
    // but still rejoin wrapped legal suffixes (SHIVSHAKTI / ENTERPRISES, CITY).
    const isContinuation =
      Boolean(prev) &&
      (
        /^[a-z]/.test(line) ||
        suffixOrCommaWrap ||
        (
          !isLikelyPersonName(prev) &&
          line.includes(',') &&
          /^[A-Z][A-Z\s&.-]+$/.test(prev) &&
          !prev.includes(',') &&
          !looksLikeCompleteCompany(line)
        )
      )

    if (isContinuation) {
      const joined = line.startsWith(',') ? `${prev}${line}` : `${prev} ${line}`
      merged[merged.length - 1] = joined.replace(/\s+/g, ' ').replace(/\s+,/g, ',').trim()
    } else {
      merged.push(line)
    }
  }
  return merged
}

function parsePartyFields(partyLines: string[]): {
  sellerName: string
  sellerConfirmedBy: string
  buyerName: string
  buyerConfirmedBy: string
} {
  const slots: { company: string; person: string }[] = []
  let pendingPerson = ''

  for (const raw of partyLines) {
    const line = stripPartyLabel(raw)
    if (!line || LABEL_ONLY.test(raw.trim())) continue

    if (looksLikeCompanyName(line)) {
      if (slots.length >= 2) continue
      slots.push({
        company: line.replace(/\s*,\s*/g, ', '),
        person: pendingPerson,
      })
      pendingPerson = ''
      continue
    }

    if (isLikelyPersonName(line)) {
      const last = slots[slots.length - 1]
      if (last && !last.person) last.person = line
      else pendingPerson = line
    }
  }

  if (pendingPerson) {
    const last = slots[slots.length - 1]
    if (last && !last.person) last.person = pendingPerson
  }

  return {
    sellerName: slots[0]?.company ?? '',
    sellerConfirmedBy: slots[0]?.person ?? '',
    buyerName: slots[1]?.company ?? '',
    buyerConfirmedBy: slots[1]?.person ?? '',
  }
}

interface PdfTextItem {
  str: string
  x: number
  y: number
  height: number
}

function headerLinesFromPageItems(items: PdfTextItem[]): string[] {
  const contractItem = items.find(it => /contract confirmation/i.test(it.str))
  if (!contractItem) return []

  const headerItems = items.filter(it => it.y > contractItem.y + 2)
  return groupPositionedLines(headerItems).map(l => l.text)
}

function parseBrokerFromPageItems(items: PdfTextItem[]): string {
  const contractItem = items.find(it => /contract confirmation/i.test(it.str))
  const headerItems = contractItem
    ? items.filter(it => it.y > contractItem.y + 2)
    : items.filter(it => {
        const maxY = Math.max(...items.map(i => i.y))
        return it.y > maxY * 0.62
      })

  const positioned = groupPositionedLines(headerItems)
  return parseBrokerFromHeadingLines(positioned)
}

function resolveBrokerName(
  text: string,
  headerLines: string[],
  pageItems: PdfTextItem[],
): string {
  const candidates = [
    parseBrokerNameFromHeader(headerLines),
    parseBrokerFromPageItems(pageItems),
    parseBrokerNameFromHeaderText(text),
  ].map(c => c.trim()).filter(Boolean)

  return candidates[0] ?? ''
}

export function parseContractText(
  text: string,
  _headerLines: string[] = [],
  brokerName = '',
): ParsedContractPdf {
  const normalized = normalizeText(text)

  const valuesBlock = normalized.match(/BROKERAGE:\s*\n+([\s\S]*?)\n\s*Other Terms:/i)?.[1] ?? ''
  const rawLines = valuesBlock.split('\n').map(l => l.trim()).filter(Boolean)
  const lines = mergeBrokenLines(rawLines)

  const quantityLine = lines.find(l => /TON/i.test(l))
  const rateLine = lines.find(l => /PER\s*(10\s*KG|TON)/i.test(l))
  const deliveryLine = lines.find(l => /\d{1,2}-[A-Za-z]{3}\s*TO\s*\d{1,2}-[A-Za-z]{3}/i.test(l))
  const readyDeliveryLine = lines.find(isReadyDeliveryLine)
  const paymentLine = lines.find(l => /^(ADVANCE|AGAINST|CREDIT)/i.test(l))
  const remarksLine = lines.find(l => l === 'FIXED DUTY' || (l.toUpperCase().includes('DUTY') && !l.match(/PER\s/i)))
  const brokerageLine = lines.find(l => /RS\.?\s*PER\s*TON/i.test(l))

  const contractNo = lines.find(l => /^\d+$/.test(l)) ?? normalized.match(/CONTRACT NO\.:\s*(\d+)/i)?.[1] ?? ''
  const dateLine = lines.find(l => /^\d{2}-\d{2}-\d{4}$/.test(l)) ?? ''
  const contractDate = dateLine ? parseContractDate(dateLine) : ''
  const contractYear = contractDate ? parseInt(contractDate.slice(0, 4), 10) : new Date().getFullYear()

  const structuredLines = lines.filter(l =>
    l !== contractNo &&
    l !== dateLine &&
    l !== quantityLine &&
    l !== rateLine &&
    l !== deliveryLine &&
    l !== readyDeliveryLine &&
    l !== paymentLine &&
    l !== remarksLine &&
    l !== brokerageLine,
  )

  const materialIndex = structuredLines.findIndex(l => /^(REF\.|RBD|CRUDE|SOYA|PALM|SUN|COTTON)/i.test(l))
  const partyLines = materialIndex >= 0 ? structuredLines.slice(0, materialIndex) : structuredLines.slice(0, 4)
  const itemName = materialIndex >= 0
    ? structuredLines[materialIndex].replace(/^REF\.\s*/i, '').trim()
    : structuredLines.find(l => /OIL|MEAL|SEED|COMMODITY/i.test(l))?.replace(/^REF\.\s*/i, '').trim() ?? ''

  const { sellerName, sellerConfirmedBy, buyerName, buyerConfirmedBy } = parsePartyFields(partyLines)

  const quantityMatch = quantityLine?.match(/([\d,]+(?:\.\d+)?)\s*TON/i)
  const quantityMt = quantityMatch ? parseFloat(quantityMatch[1].replace(/,/g, '')) : 0

  const rate = rateLine ? parseRate(rateLine) : {
    ratePerMt: 0,
    ratePerBasis: 0,
    ratePerBasisFormatted: '',
    rateBasis: 'PER 10 KG',
    rateIncludesGst: false,
    rateDisplay: '',
    brand: '',
  }

  const deliveryType: DeliveryType = readyDeliveryLine ? 'ready' : 'period'
  let deliveryPeriodStart = ''
  let deliveryPeriodEnd = ''
  const deliveryMatch = deliveryLine?.match(/(\d{1,2}-[A-Za-z]{3})\s*TO\s*(\d{1,2}-[A-Za-z]{3})/i)
  if (deliveryMatch) {
    deliveryPeriodStart = parseDeliveryDate(deliveryMatch[1], contractYear)
    deliveryPeriodEnd = parseDeliveryDate(deliveryMatch[2], contractYear)
  } else if (deliveryType === 'ready') {
    const readyDate = contractDate || new Date().toISOString().slice(0, 10)
    deliveryPeriodStart = readyDate
    deliveryPeriodEnd = readyDate
  }

  const brokerageMatch = brokerageLine?.match(/([\d,]+(?:\.\d+)?)\s*RS\.?\s*PER\s*TON/i)
  const brokeragePerTon = brokerageMatch ? parseFloat(brokerageMatch[1].replace(/,/g, '')) : 0

  const gstMatch = normalized.match(/GST#\s*Seller:\s*(\S+)\s*,?\s*Buyer:\s*(\S+)/i)

  return {
    brokerContractRef: contractNo,
    contractDate,
    sellerName,
    sellerConfirmedBy,
    buyerName,
    buyerConfirmedBy,
    itemName,
    quantityMt,
    ratePerMt: rate.ratePerMt,
    ratePerBasis: rate.ratePerBasis,
    ratePerBasisFormatted: rate.ratePerBasisFormatted,
    rateBasis: rate.rateBasis,
    rateIncludesGst: rate.rateIncludesGst,
    rateDisplay: rate.rateDisplay,
    brand: rate.brand,
    deliveryType,
    deliveryPeriodStart,
    deliveryPeriodEnd,
    paymentTerms: paymentLine ?? '',
    remarks: remarksLine ?? '',
    brokeragePerTon,
    sellerGst: gstMatch?.[1]?.replace(/,$/, '') ?? '',
    buyerGst: gstMatch?.[2]?.replace(/,$/, '') ?? '',
    brokerName,
  }
}

export async function extractPdfText(file: File): Promise<string> {
  const { pages } = await extractPdfPages(file)
  return pages.map(p => p.text).join('\n')
}

async function extractPdfPages(file: File): Promise<{
  pages: { text: string; items: PdfTextItem[] }[]
}> {
  const { getDocument } = await getPdfJs()
  const buffer = await file.arrayBuffer()
  const pdf = await getDocument({ data: new Uint8Array(buffer) }).promise
  const pages: { text: string; items: PdfTextItem[] }[] = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const content = await page.getTextContent()
    const items: PdfTextItem[] = content.items.flatMap(item => {
      if (!('str' in item)) return []
      const transform = item.transform
      const height = item.height || Math.abs(transform[3]) || 0
      return [{ str: item.str, x: transform[4], y: transform[5], height }]
    })
    pages.push({
      text: items.map(item => item.str).join('\n'),
      items,
    })
  }

  return { pages }
}

export async function parseContractPdf(file: File): Promise<ParsedContractPdf> {
  const { pages } = await extractPdfPages(file)
  const text = pages.map(p => p.text).join('\n')
  const pageItems = pages[0]?.items ?? []
  const headerLines = headerLinesFromPageItems(pageItems)
  const brokerName = resolveBrokerName(text, headerLines, pageItems)
  const parsed = parseContractText(text, headerLines, brokerName)

  if (!parsed.brokerContractRef && !parsed.sellerName && !parsed.buyerName) {
    throw new Error('Could not read contract fields from this PDF. Use a broker contract confirmation export.')
  }

  return parsed
}

export function contractToFormValues(
  parsed: ParsedContractPdf,
  side: 'purchase' | 'sale',
): Record<string, string> {
  const partyName = side === 'purchase' ? parsed.sellerName : parsed.buyerName

  return {
    brokerContractRef: parsed.brokerContractRef,
    date: parsed.contractDate || new Date().toISOString().slice(0, 10),
    partyName,
    sellerName: side === 'sale' ? CURRENT_TRADER : parsed.sellerName,
    sellerConfirmedBy: displayPartyConfirmedBy(parsed.sellerConfirmedBy),
    buyerName: side === 'purchase' ? CURRENT_TRADER : parsed.buyerName,
    buyerConfirmedBy: displayPartyConfirmedBy(parsed.buyerConfirmedBy),
    itemName: parsed.itemName,
    spot: parsed.brand,
    quantity: parsed.quantityMt ? String(parsed.quantityMt) : '',
    rate: parsed.ratePerBasis
      ? (parsed.ratePerBasisFormatted || formatIndianAmount(parsed.ratePerBasis))
      : '',
    contractRateDisplay: parsed.rateDisplay || (parsed.ratePerBasis
      ? `${parsed.ratePerBasisFormatted || formatIndianAmount(parsed.ratePerBasis)} PER 10 KG${parsed.rateIncludesGst ? ' + GST' : ''}`
      : ''),
    ratePerBasis: parsed.ratePerBasis
      ? (parsed.ratePerBasisFormatted || formatIndianAmount(parsed.ratePerBasis))
      : '',
    rateBasis: 'PER 10 KG',
    deliveryType: parsed.deliveryType,
    deliveryPeriodStart: parsed.deliveryPeriodStart,
    deliveryPeriodEnd: parsed.deliveryPeriodEnd,
    brokerageType: parsed.brokeragePerTon ? 'perTon' : 'percent',
    brokeragePerTon: parsed.brokeragePerTon ? formatIndianAmount(parsed.brokeragePerTon) : '',
    brokeragePct: '0',
    paymentTerms: parsed.paymentTerms,
    remarks: parsed.remarks,
    taxRate: '5',
  }
}
