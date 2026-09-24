import type { ReactNode } from 'react'
import { AddOnMarketplaceGridCard } from './AddOnMarketplaceGridCard'
import type { OrgFeatureOffer } from '../../api/organisationApi'
import { useBrowseMarketplaceCardSize } from '../../hooks/useBrowseMarketplaceCardWidth'
import { cn } from '../../lib/utils'

/**
 * Renders an add-on card at the Browse tile width (org Add-ons grid).
 * Matches live marketplace cards (4/3 image + content-hugging details).
 */
export function AddOnBrowseCardPreview({
  offer,
  active = true,
  imageOverlay,
  className,
}: {
  offer: OrgFeatureOffer
  /** When false, skips resize listeners (e.g. closed drawer). */
  active?: boolean
  imageOverlay?: ReactNode
  className?: string
}) {
  const size = useBrowseMarketplaceCardSize(active)

  return (
    <div className={cn('flex justify-center overflow-x-auto', className)}>
      <div className="shrink-0" style={{ width: size.width }}>
        <AddOnMarketplaceGridCard
          className="w-full"
          offer={offer}
          interactive={false}
          imageOverlay={imageOverlay}
        />
      </div>
    </div>
  )
}
