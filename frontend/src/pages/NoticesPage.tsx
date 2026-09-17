import { useCallback, useState } from 'react'
import { Bell } from 'lucide-react'
import { PageHeader } from '../components/ui/CommandPalette'
import { Breadcrumb, EmptyState } from '../components/ui/Tabs'
import { Button } from '../components/ui/Button'
import { NoticeListItem } from '../components/notifications/NoticeListItem'
import { SystemUpdateModal } from '../components/layout/SystemUpdateModal'
import { useUserNotifications } from '../hooks/useUserNotifications'
import { useAuth } from '../hooks/useAuth'
import { organisationApi } from '../api/organisationApi'
import { authApi } from '../api/tradeApi'
import { sessionFromApi } from '../lib/authSession'
import { saveAuthSession } from '../lib/auth'
import { APP_HOME } from '../lib/appShellMode'
import type { UserNotification } from '../api/platformApi'

export function NoticesPage() {
  const { session } = useAuth()
  const { notifications, unread, markRead, markAllRead, refresh } = useUserNotifications(true)
  const [updating, setUpdating] = useState<UserNotification | null>(null)

  const applyNotice = useCallback(async (notificationId: number) => {
    await organisationApi.applyNotificationUpdate(notificationId)
    if (session?.token) {
      const me = await authApi.me()
      saveAuthSession(sessionFromApi(me, session.token))
    }
    void refresh()
  }, [refresh, session?.token])

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="From Tradeal"
        subtitle="Notices for your organisation — credentials, payment reminders, and product updates. Trade follow-ups stay in the Action inbox on the dashboard."
        breadcrumb={<Breadcrumb items={[{ label: 'Tradeal', href: APP_HOME }, { label: 'From Tradeal' }]} />}
        actions={
          unread > 0 ? (
            <Button variant="outline" size="sm" onClick={() => void markAllRead()}>
              Mark all read
            </Button>
          ) : undefined
        }
      />

      {notifications.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-8 w-8" />}
          title="No notices yet"
          description="When Tradeal sends credentials, reminders, or product updates, they appear here."
        />
      ) : (
        <div className="rounded-md bg-card shadow-[var(--shadow-card)] overflow-hidden">
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {notifications.map(item => (
              <NoticeListItem
                key={item.id}
                item={item}
                onMarkRead={id => void markRead(id)}
                onApply={setUpdating}
              />
            ))}
          </div>
        </div>
      )}

      <SystemUpdateModal
        open={!!updating}
        notification={updating}
        onClose={() => setUpdating(null)}
        onApply={applyNotice}
      />
    </div>
  )
}
