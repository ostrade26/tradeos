/**
 * Storyset Pana illustrations for special-state modals.
 * Credit: https://storyset.com/pana (Freepik Storyset)
 */
import backupHardDrivePana from './modal-backup-hard-drive-pana.png'
import featureRocketGreenPana from './modal-feature-rocket-green-pana.png'
import releaseRocketBluePana from './modal-release-rocket-blue-pana.png'
import updateUiDesignPana from './modal-update-ui-design-pana.png'
import maintenanceConstructionPana from './modal-maintenance-construction-pana.png'

export const MODAL_ILLUSTRATIONS = {
  /** Product update — blue rocket */
  productUpdate: releaseRocketBluePana,
  /** Platform release — green rocket */
  platformRelease: featureRocketGreenPana,
  /** Features marketplace — UI/UX design */
  marketplace: updateUiDesignPana,
  /** Backup reminder — hard drive */
  backup: backupHardDrivePana,
  /** Maintenance — under construction */
  maintenance: maintenanceConstructionPana,
} as const

export type ModalIllustrationKey = keyof typeof MODAL_ILLUSTRATIONS

export function ModalPanaIllustration({
  kind,
  className,
  alt = '',
}: {
  kind: ModalIllustrationKey
  className?: string
  alt?: string
}) {
  return (
    <img
      src={MODAL_ILLUSTRATIONS[kind]}
      alt={alt}
      width={560}
      height={360}
      decoding="async"
      draggable={false}
      className={className}
    />
  )
}

/** Shared frame so every modal illustration paints at the same height. */
export const MODAL_ILLUSTRATION_FRAME =
  'mx-auto flex h-44 w-full max-w-[20rem] items-center justify-center sm:h-48 sm:max-w-[22rem]'

export const MODAL_ILLUSTRATION_IMG =
  'h-full w-full select-none pointer-events-none object-contain object-center'
