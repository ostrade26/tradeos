import { useEffect, useState } from 'react'
import { browseMarketplaceCardSizePx } from '../lib/addOnMarketplaceStats'

/** Live Browse tile size for platform previews (matches org Add-ons grid). */
export function useBrowseMarketplaceCardSize(active = true): { width: number; height: number } {
  const [size, setSize] = useState(() => browseMarketplaceCardSizePx())

  useEffect(() => {
    if (!active) return

    const update = () => setSize(browseMarketplaceCardSizePx())
    update()

    window.addEventListener('resize', update)

    const main = document.getElementById('main-content')
    const ro = main ? new ResizeObserver(update) : null
    if (main && ro) ro.observe(main)

    return () => {
      window.removeEventListener('resize', update)
      ro?.disconnect()
    }
  }, [active])

  return size
}
