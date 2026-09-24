import { Link } from 'react-router-dom'
import { appPath } from '../../lib/appShellMode'

/** Short CTA when Custom branding is locked. */
export function BrandingUpsellNote({ className }: { className?: string }) {
  return (
    <p className={className ?? 'text-xs text-muted max-w-[11rem] text-right leading-snug'}>
      Available with{' '}
      <Link to={appPath('/addons')} className="font-medium text-accent hover:underline">
        Custom branding
      </Link>
    </p>
  )
}
