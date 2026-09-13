/** Shared broker-name detection for PDF text and OCR output */

export function isBrokerTagline(line: string): boolean {
  return /^(all kinds|kinds of|all type|deals in|specializing in|tu kinds)/i.test(line)
    || (/edible oil broker/i.test(line) && !/\bbroker'?s\b/i.test(line))
    || (/echible oi/i.test(line) && /broker/i.test(line))
}

export function cleanBrokerLine(line: string): string {
  return line
    .replace(/[^\w\s&,.'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\bHREE\b/gi, 'SHREE')
    .replace(/\bSHRI\b/gi, 'SHRI')
    .trim()
}

export function isBrokerFirmLine(line: string): boolean {
  const cleaned = cleanBrokerLine(line)
  if (!cleaned || cleaned.length < 6 || cleaned.length > 120) return false
  if (isBrokerTagline(cleaned)) return false
  if (/^[.\s]+$/.test(cleaned)) return false
  if (/contract|confirmation|^gst|phone|mob|email|www\.|thank|computer generated|inform you/i.test(cleaned)) {
    return false
  }

  if (/\bBROKER'S\b/i.test(cleaned) || /\bBROKERS\b/i.test(cleaned)) return true
  if (/gurukrupa/i.test(cleaned) && /broker/i.test(cleaned)) return true
  if (/\bbroker\b/i.test(cleaned) && /\b(shree|shri|m\/s|guru|krupa)\b/i.test(cleaned)) return true
  if (/\bbroker\b/i.test(cleaned) && /^[A-Z0-9\s&.'-]+$/i.test(cleaned) && cleaned.length >= 10) {
    return true
  }
  return false
}

/** Broker firm name from letterhead lines (text or OCR). */
export function parseBrokerNameFromHeader(headerLines: string[]): string {
  for (const line of headerLines) {
    if (isBrokerFirmLine(line)) return cleanBrokerLine(line)
  }
  return ''
}

export function parseBrokerNameFromHeaderText(text: string): string {
  const stop = text.search(/\bCONTRACT\s+CONFIRMATION\b/i)
  const header = stop >= 0 ? text.slice(0, stop) : text.slice(0, 800)
  const lines = header.split('\n').map(l => l.trim()).filter(Boolean)
  return parseBrokerNameFromHeader(lines)
}

export interface PositionedTextLine {
  text: string
  y: number
  maxHeight: number
}

export function groupPositionedLines(
  items: { str: string; x: number; y: number; height: number }[],
): PositionedTextLine[] {
  const sorted = items
    .filter(it => it.str.trim())
    .sort((a, b) => b.y - a.y || a.x - b.x)

  const rows: { y: number; parts: string[]; maxHeight: number }[] = []
  for (const item of sorted) {
    const row = rows.find(l => Math.abs(l.y - item.y) < 5)
    const h = item.height || 0
    if (row) {
      row.parts.push(item.str)
      row.maxHeight = Math.max(row.maxHeight, h)
    } else {
      rows.push({ y: item.y, parts: [item.str], maxHeight: h })
    }
  }

  return rows.map(l => ({
    text: l.parts.join(' ').replace(/\s+/g, ' ').trim(),
    y: l.y,
    maxHeight: l.maxHeight,
  })).filter(l => l.text)
}

/** Pick main heading by largest font in header zone (when letterhead is text, not image). */
export function parseBrokerFromHeadingLines(lines: PositionedTextLine[]): string {
  const bodyHeight = lines.reduce((max, l) => Math.max(max, l.maxHeight), 0)
  const headingThreshold = Math.max(bodyHeight * 0.85, 11)

  const headerCandidates = [...lines]
    .filter(l => !/contract confirmation/i.test(l.text))
    .sort((a, b) => b.maxHeight - a.maxHeight || b.y - a.y)

  for (const line of headerCandidates) {
    if (isBrokerFirmLine(line.text)) return cleanBrokerLine(line.text)
  }

  for (const line of headerCandidates) {
    if (line.maxHeight >= headingThreshold && line.text.length >= 8 && line.text.length <= 80) {
      if (isBrokerTagline(line.text)) continue
      if (/contract|confirmation|commodity|hereby/i.test(line.text)) continue
      const words = line.text.split(/\s+/).filter(Boolean)
      if (words.length >= 2 && words.length <= 10) {
        return cleanBrokerLine(line.text)
      }
    }
  }

  return ''
}
