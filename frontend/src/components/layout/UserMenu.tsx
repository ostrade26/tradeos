import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LogOut, Settings, Shield, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { DropdownPanel } from './DropdownPanel'
import { useAuth } from '../../hooks/useAuth'
import { useUser } from '../../hooks/useUser'
import { useLocation } from 'react-router-dom'
import { isPlatformAdminPath } from '../../lib/appShellMode'

export function UserMenu() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { profile, initials } = useUser()
  const { roleLabel, logout, session, isPlatformAdmin } = useAuth()
  const platformConsole = isPlatformAdmin && isPlatformAdminPath(location.pathname)
  const profilePath = platformConsole ? '/platform-admin/profile' : '/profile'
  const settingsPath = platformConsole ? '/platform-admin/settings' : '/settings'

  return (
    <DropdownPanel
      open={open}
      onOpenChange={setOpen}
      width={240}
      trigger={({ ref, onClick, 'aria-expanded': expanded }) => (
        <button
          ref={ref}
          type="button"
          onClick={onClick}
          aria-expanded={expanded}
          aria-label="User menu"
          className="flex min-h-10 sm:min-h-11 items-center gap-2.5 pl-0.5 sm:pl-1 min-w-0 rounded-lg px-0.5 sm:px-1 py-1 hover:bg-gray-100 dark:hover:bg-gray-700/30 transition-colors cursor-pointer attex-focus"
        >
          <div className="flex h-9 w-9 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-white">
            {initials}
          </div>
          <div className="hidden md:block min-w-0 text-left">
            <p className="text-sm font-medium text-heading truncate leading-tight">{profile.name}</p>
            <p className="text-xs text-muted truncate leading-tight">{profile.location}</p>
          </div>
        </button>
      )}
    >
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <p className="text-sm font-semibold text-heading truncate">{profile.name}</p>
        <p className="text-xs text-muted truncate">{profile.email}</p>
        {session?.organisationName && (
          <p className="text-xs text-muted truncate mt-0.5">{session.organisationName}</p>
        )}
        {roleLabel && (
          <p className="text-xs font-medium text-accent mt-1">{roleLabel}</p>
        )}
      </div>
      <div className="py-1">
        <Link
          to={profilePath}
          onClick={() => setOpen(false)}
          className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-heading hover:bg-gray-50 dark:hover:bg-gray-800/60"
        >
          <User className="h-4 w-4 text-muted" />
          Profile
        </Link>
        {isPlatformAdmin && !platformConsole && (
          <Link
            to="/platform-admin/organisations"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-heading hover:bg-gray-50 dark:hover:bg-gray-800/60"
          >
            <Shield className="h-4 w-4 text-muted" />
            Tradeal Admin
          </Link>
        )}
        <Link
          to={settingsPath}
          onClick={() => setOpen(false)}
          className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-heading hover:bg-gray-50 dark:hover:bg-gray-800/60"
        >
          <Settings className="h-4 w-4 text-muted" />
          Settings
        </Link>
        <button
          type="button"
          onClick={async () => {
            setOpen(false)
            await logout()
            navigate('/login')
          }}
          className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-heading hover:bg-gray-50 dark:hover:bg-gray-800/60 border-t border-gray-200 dark:border-gray-700"
        >
          <LogOut className="h-4 w-4 text-muted" />
          Sign out
        </button>
      </div>
    </DropdownPanel>
  )
}
