import { parseBrokerNameFromHeader } from './brokerNameExtraction'

let pdfjsModule: typeof import('pdfjs-dist') | null = null

async function getPdfJs() {
  if (!pdfjsModule) {
    pdfjsModule = await import('pdfjs-dist')
    pdfjsModule.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString()
  }
  return pdfjsModule
}

/** OCR the top of page 1 — broker letterhead is often an embedded image. */
export async function ocrBrokerNameFromPdfHeader(file: File): Promise<string> {
  const { getDocument } = await getPdfJs()
  const buffer = await file.arrayBuffer()
  const pdf = await getDocument({ data: new Uint8Array(buffer) }).promise
  const page = await pdf.getPage(1)
  const scale = 2.5
  const viewport = page.getViewport({ scale })

  const fullCanvas = document.createElement('canvas')
  const ctx = fullCanvas.getContext('2d')
  if (!ctx) return ''

  fullCanvas.width = viewport.width
  fullCanvas.height = viewport.height

  await page.render({ canvasContext: ctx, viewport, canvas: fullCanvas }).promise

  const headerHeight = Math.floor(viewport.height * 0.34)
  const headerCanvas = document.createElement('canvas')
  headerCanvas.width = viewport.width
  headerCanvas.height = headerHeight
  const headerCtx = headerCanvas.getContext('2d')
  if (!headerCtx) return ''

  headerCtx.drawImage(
    fullCanvas,
    0, 0, viewport.width, headerHeight,
    0, 0, viewport.width, headerHeight,
  )

  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng', 1, {
    logger: () => {},
  })

  try {
    const { data: { text } } = await worker.recognize(headerCanvas)
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    return parseBrokerNameFromHeader(lines)
  } finally {
    await worker.terminate()
  }
}
