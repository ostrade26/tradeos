/**
 * Hard guards for contract PDF import — size, magic bytes, page caps, field sanitize.
 * Keep in sync with `.cursor/rules/pdf-import-protected.mdc`.
 */

export const PDF_IMPORT_MAX_BYTES = 15 * 1024 * 1024
export const PDF_IMPORT_MAX_PAGES = 20
export const PDF_IMPORT_MAX_FIELD_CHARS = 500
export const PDF_IMPORT_MAX_REMARKS_CHARS = 2000

const PDF_MAGIC = '%PDF'

function looksLikePdfName(name: string): boolean {
  return name.toLowerCase().endsWith('.pdf')
}

function looksLikePdfMime(type: string): boolean {
  if (!type) return true
  const t = type.toLowerCase()
  return t === 'application/pdf' || t === 'application/x-pdf'
}

/** Reject empty / oversized / non-PDF uploads before PDF.js runs. */
export async function assertSafePdfFile(file: File): Promise<void> {
  if (!(file instanceof File) || file.size <= 0) {
    throw new Error('Please upload a PDF contract confirmation')
  }
  if (file.size > PDF_IMPORT_MAX_BYTES) {
    throw new Error('PDF is too large (max 15 MB)')
  }
  if (!looksLikePdfName(file.name) && !looksLikePdfMime(file.type)) {
    throw new Error('Please upload a PDF contract confirmation')
  }

  const head = new Uint8Array(await file.slice(0, PDF_MAGIC.length).arrayBuffer())
  const magic = String.fromCharCode(...head)
  if (magic !== PDF_MAGIC) {
    throw new Error('File is not a valid PDF')
  }
}

/** Strip control chars and cap length — extracted PDF text is untrusted. */
export function sanitizePdfField(value: string, maxChars = PDF_IMPORT_MAX_FIELD_CHARS): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim()
    .slice(0, maxChars)
}

export function sanitizeParsedContractStrings<T extends Record<string, unknown>>(parsed: T): T {
  const out: Record<string, unknown> = { ...parsed }
  for (const [key, val] of Object.entries(out)) {
    if (typeof val !== 'string') continue
    const max = key === 'remarks' ? PDF_IMPORT_MAX_REMARKS_CHARS : PDF_IMPORT_MAX_FIELD_CHARS
    out[key] = sanitizePdfField(val, max)
  }
  return out as T
}
