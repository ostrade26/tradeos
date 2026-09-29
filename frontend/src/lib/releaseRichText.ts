/** Colours an admin can apply to selected release detail text. */
export const RELEASE_TEXT_COLORS = [
  { id: 'red', label: 'Red', hex: '#dc2626' },
  { id: 'amber', label: 'Amber', hex: '#d97706' },
  { id: 'green', label: 'Green', hex: '#059669' },
  { id: 'blue', label: 'Blue', hex: '#2563eb' },
] as const

export type ReleaseTextColorId = (typeof RELEASE_TEXT_COLORS)[number]['id']

const COLOR_BY_HEX = new Map(
  RELEASE_TEXT_COLORS.map(color => [color.hex.toLowerCase(), color.id]),
)

const COLOR_BY_ID = new Set<string>(RELEASE_TEXT_COLORS.map(color => color.id))

const ALLOWED_TAGS = new Set(['B', 'STRONG', 'UL', 'OL', 'LI', 'P', 'DIV', 'BR', 'SPAN', 'FONT'])
const DROP_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'SVG'])

export function releaseColorId(value: string | null | undefined): ReleaseTextColorId | null {
  const text = String(value ?? '').trim().toLowerCase()
  if (!text) return null
  if (COLOR_BY_ID.has(text)) return text as ReleaseTextColorId
  const hex = text.startsWith('#') ? text : rgbToHex(text)
  if (!hex) return null
  return COLOR_BY_HEX.get(hex) ?? null
}

function rgbToHex(value: string): string | null {
  const match = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (!match) return null
  const parts = [match[1], match[2], match[3]].map(part =>
    Math.max(0, Math.min(255, Number(part))).toString(16).padStart(2, '0'),
  )
  return `#${parts.join('')}`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** True when the stored detail already carries formatting tags. */
export function isReleaseRichHtml(value: string): boolean {
  return /<\/?(?:b|strong|ul|ol|li|p|div|br|span|font)\b/i.test(value)
}

/** Plain text for compact previews. Formatting tags are removed; line breaks stay. */
export function plainTextFromReleaseDetail(value: string): string {
  const text = value.trim()
  if (!text) return ''
  if (!isReleaseRichHtml(text)) return text
  if (typeof DOMParser === 'undefined') {
    return text.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, '').trim()
  }
  const doc = new DOMParser().parseFromString(sanitizeReleaseHtml(text), 'text/html')
  return (doc.body.textContent ?? '').replace(/\u00a0/g, ' ').trim()
}

/** Turn a legacy plain-text detail into paragraphs so each line can become a list item. */
export function plainReleaseDetailToHtml(value: string): string {
  const lines = value.replace(/\r\n/g, '\n').split('\n')
  return lines.map(line => `<p>${line ? escapeHtml(line) : '<br>'}</p>`).join('')
}

export function releaseDetailForEditor(value: string): string {
  const text = value.trim()
  if (!text) return ''
  if (isReleaseRichHtml(value)) return sanitizeReleaseHtml(value)
  return plainReleaseDetailToHtml(value)
}

/**
 * Keep bold, lists, and the colour palette. Drop every other tag and attribute.
 */
export function sanitizeReleaseHtml(html: string): string {
  const source = html.trim()
  if (!source || typeof DOMParser === 'undefined') return ''
  const doc = new DOMParser().parseFromString(`<div>${source}</div>`, 'text/html')
  const root = doc.body.firstElementChild
  if (!root) return ''
  cleanRichNode(doc, root)
  for (const el of [...root.querySelectorAll('p, div')]) {
    if (!el.textContent?.trim() && !el.querySelector('br, ul, ol')) el.remove()
  }
  return root.innerHTML.trim()
}

function cleanRichNode(doc: Document, node: Element) {
  for (const child of [...node.childNodes]) {
    if (child.nodeType === Node.TEXT_NODE) continue
    if (child.nodeType !== Node.ELEMENT_NODE) {
      child.remove()
      continue
    }
    const el = child as Element
    const tag = el.tagName
    if (DROP_TAGS.has(tag)) {
      el.remove()
      continue
    }
    if (tag === 'FONT') {
      const span = doc.createElement('span')
      const color = releaseColorId(el.getAttribute('color'))
      if (color) span.setAttribute('data-color', color)
      while (el.firstChild) span.appendChild(el.firstChild)
      el.replaceWith(span)
      cleanRichNode(doc, span)
      continue
    }
    if (!ALLOWED_TAGS.has(tag)) {
      const parent = el.parentNode
      if (!parent) {
        el.remove()
        continue
      }
      const moved: Element[] = []
      while (el.firstChild) {
        const next = el.firstChild
        parent.insertBefore(next, el)
        if (next.nodeType === Node.ELEMENT_NODE) moved.push(next as Element)
      }
      el.remove()
      for (const item of moved) cleanRichNode(doc, item.parentElement ?? node)
      continue
    }
    if (tag === 'SPAN') {
      const style = el.getAttribute('style') || ''
      const styleColor = style.match(/color\s*:\s*([^;]+)/)?.[1]
      const color = releaseColorId(el.getAttribute('data-color')) || releaseColorId(styleColor)
      const bold = /font-weight\s*:\s*(bold|[6-9]00)\b/i.test(style)
      const parent = el.parentNode
      if (!parent) {
        el.remove()
        continue
      }
      const body = doc.createElement(bold ? 'strong' : 'span')
      if (!bold && color) body.setAttribute('data-color', color)
      while (el.firstChild) body.appendChild(el.firstChild)
      if (bold && color) {
        const colored = doc.createElement('span')
        colored.setAttribute('data-color', color)
        colored.appendChild(body)
        el.replaceWith(colored)
        cleanRichNode(doc, colored)
      } else if (!bold && !color) {
        while (body.firstChild) parent.insertBefore(body.firstChild, el)
        el.remove()
      } else {
        el.replaceWith(body)
        cleanRichNode(doc, body)
      }
      continue
    } else {
      for (const attr of [...el.attributes]) el.removeAttribute(attr.name)
    }
    cleanRichNode(doc, el)
  }
}
