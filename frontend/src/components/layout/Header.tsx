import { Search, Command, Menu, Settings, Bot } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { Button } from '../ui/Button'
import { NotificationsDropdown } from './NotificationsDropdown'
import { UserMenu } from './UserMenu'
import { cn } from '../../lib/utils'
import { appPath, isPlatformAdminPath } from '../../lib/appShellMode'

interface HeaderProps {
  onOpenCommand: () => void
  onOpenAssistant: () => void
  onOpenMobileNav: () => void
}

const navIconButtonClass = 'h-10 w-10 sm:h-11 sm:w-11'

export function Header({
  onOpenCommand,
  onOpenAssistant,
  onOpenMobileNav,
}: HeaderProps) {
  const location = useLocation()
  const platformAdminMode = isPlatformAdminPath(location.pathname)
  const settingsPath = platformAdminMode ? '/platform-admin/settings' : appPath('/settings')

  return (
    <header className="z-30 flex h-14 sm:h-[70px] shrink-0 items-center gap-1.5 sm:gap-3 bg-white dark:bg-card border-b border-gray-200/80 dark:border-gray-700/50 px-2.5 sm:px-6 pt-[env(safe-area-inset-top)] shadow-sm">
      <Button
        variant="ghost"
        size="icon"
        className={cn(navIconButtonClass, 'shrink-0 lg:hidden -ml-0.5')}
        onClick={onOpenMobileNav}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <button
        type="button"
        onClick={onOpenCommand}
        aria-label="Search orders, parties, lifts"
        className="flex min-w-0 flex-1 max-w-[9.5rem] sm:max-w-md lg:max-w-xl items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-2.5 sm:px-3 py-2 text-sm text-muted hover:border-accent/40 hover:text-accent transition-colors cursor-pointer dark:border-gray-600 dark:bg-gray-700/30 attex-focus"
      >
        <Search className="h-[1.125rem] w-[1.125rem] shrink-0" />
        <span className="hidden sm:inline flex-1 text-left truncate">
          {platformAdminMode ? 'Search organisations, users, plans…' : 'Search orders, parties, lifts…'}
        </span>
        <kbd className="hidden md:flex items-center gap-0.5 rounded border border-gray-200 dark:border-gray-600 px-1.5 py-0.5 text-[10px] shrink-0">
          <Command className="h-3 w-3" />K
        </kbd>
      </button>

      <div className="flex items-center gap-0 sm:gap-1.5 shrink-0 ml-auto">
        <Button
          variant="ghost"
          size="icon"
          className={cn(navIconButtonClass, 'shrink-0')}
          onClick={() => onOpenAssistant()}
          aria-label="Ask AI"
          title="Ask AI (⌘J)"
        >
          <Bot className="h-5 w-5" />
        </Button>
        <NotificationsDropdown />
        <div className="hidden md:contents">
          <Button variant="ghost" size="icon" className={navIconButtonClass} aria-label="Settings" to={settingsPath}>
            <Settings className="h-5 w-5" />
          </Button>
        </div>
        <UserMenu />
      </div>
    </header>
  )
}
