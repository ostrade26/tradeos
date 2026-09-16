/** PDF.js loader — worker URL must use Vite `?url` (not `new URL(..., import.meta.url)`). */
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

let pdfjsModule: typeof import('pdfjs-dist') | null = null

export async function getPdfJs(): Promise<typeof import('pdfjs-dist')> {
  if (!pdfjsModule) {
    pdfjsModule = await import('pdfjs-dist')
    pdfjsModule.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
  }
  return pdfjsModule
}
