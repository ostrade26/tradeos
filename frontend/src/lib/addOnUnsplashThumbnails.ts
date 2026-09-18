/**
 * Pattern thumbnails sourced from Unsplash (https://unsplash.com/s/photos/patterns).
 * Bundled under /public/addons/patterns so tiles load without hotlink 404s.
 */

export const ADDON_PATTERN_THUMBNAILS: readonly string[] = [
  '/addons/patterns/01.jpg',
  '/addons/patterns/02.jpg',
  '/addons/patterns/03.jpg',
  '/addons/patterns/04.jpg',
  '/addons/patterns/05.jpg',
  '/addons/patterns/06.jpg',
  '/addons/patterns/07.jpg',
  '/addons/patterns/08.jpg',
  '/addons/patterns/09.jpg',
]

function hashKey(key: string): number {
  let h = 0
  for (let i = 0; i < key.length; i += 1) {
    h = (Math.imul(31, h) + key.charCodeAt(i)) >>> 0
  }
  return h
}

export function patternThumbnailForFeatureKey(featureKey: string): string {
  const idx = hashKey(featureKey) % ADDON_PATTERN_THUMBNAILS.length
  return ADDON_PATTERN_THUMBNAILS[idx]!
}
