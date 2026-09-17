import type { ProductRequestAttachment } from '../api/platformApi'

export const SCREENSHOT_MAX = 3
const MAX_EDGE = 1400
const JPEG_QUALITY = 0.72

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Could not read the screenshot'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read the screenshot'))
    img.src = src
  })
}

async function compressDataUrl(dataUrl: string): Promise<string> {
  const img = await loadImage(dataUrl)
  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height))
  const width = Math.max(1, Math.round(img.width * scale))
  const height = Math.max(1, Math.round(img.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  ctx.drawImage(img, 0, 0, width, height)
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
}

export async function fileToScreenshot(file: File): Promise<ProductRequestAttachment> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Attach a screenshot image')
  }
  const raw = await readFile(file)
  const data = file.type === 'image/gif' && file.size < 400_000 ? raw : await compressDataUrl(raw)
  const name = (file.name || 'screenshot').replace(/[^\w.\-]+/g, '_').slice(0, 80) || 'screenshot.jpg'
  return {
    name,
    mime: data.startsWith('data:image/jpeg') ? 'image/jpeg' : file.type,
    data,
  }
}
