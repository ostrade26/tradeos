/**
 * Local-only gallery for special-state modals.
 * Route is registered only when `import.meta.env.DEV`.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { ReleaseNoticeModal } from '../../components/feedback/ReleaseNoticeModal'
import { FeatureLaunchInterestModal } from '../../components/feedback/FeatureLaunchInterestModal'
import { FeatureEnhancementModal } from '../../components/feedback/FeatureEnhancementModal'
import { ServiceIssueModal } from '../../components/feedback/ServiceIssueModal'
import { ServiceIssueFullPage } from '../../components/feedback/ServiceIssueFullPage'
import { SystemUpdateModal } from '../../components/layout/SystemUpdateModal'
import { PlatformWhatsNewModal } from '../../components/platform/PlatformWhatsNewModal'
import type { ServiceIssueView } from '../../lib/serviceIssue'
import type { UserNotification } from '../../api/platformApi'
import {
  SAMPLE_BACKUP_NOTICE,
  SAMPLE_FEATURE_ENHANCEMENT_NOTICE,
  SAMPLE_FEATURE_LAUNCH_NOTICE,
  SAMPLE_GENERAL_ANNOUNCEMENT_NOTICE,
  SAMPLE_MAINTENANCE_NOTICE,
  SAMPLE_MARKETPLACE_NOTICE,
  SAMPLE_PRODUCT_UPDATE_NOTICE,
  SAMPLE_RELEASE_NOTICE,
  SAMPLE_SERVICE_ISSUES,
} from './specialStateFixtures'

type OpenState =
  | { type: 'none' }
  | { type: 'notice'; notice: UserNotification }
  | { type: 'system-update'; notice: UserNotification }
  | { type: 'feature-launch'; notice: UserNotification }
  | { type: 'feature-enable'; notice: UserNotification }
  | { type: 'whats-new' }
  | { type: 'service-modal'; issue: ServiceIssueView }
  | { type: 'service-full'; issue: ServiceIssueView }

function wait(ms: number) {
  return new Promise<void>(resolve => {
    window.setTimeout(resolve, ms)
  })
}

function GalleryCard({
  title,
  description,
  actions,
}: {
  title: string
  description: string
  actions: { label: string; onClick: () => void }[]
}) {
  return (
    <div className="rounded-md bg-card shadow-[var(--shadow-card)] p-5 space-y-3">
      <div>
        <h2 className="text-base font-semibold text-heading">{title}</h2>
        <p className="mt-1 text-sm text-muted leading-relaxed">{description}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {actions.map(action => (
          <Button key={action.label} size="sm" variant="outline" onClick={action.onClick}>
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  )
}

export function SpecialStatesGalleryPage() {
  const [open, setOpen] = useState<OpenState>({ type: 'none' })
  const [busy, setBusy] = useState(false)
  const close = () => setOpen({ type: 'none' })

  return (
    <div className="min-h-viewport bg-body text-heading">
      <div className="mx-auto max-w-4xl px-6 py-10 space-y-8">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">Local only · DEV</p>
          <h1 className="text-2xl font-semibold tracking-tight">Special states gallery</h1>
          <p className="text-sm text-muted max-w-2xl leading-relaxed">
            Redesigned announcement modals with Storyset Pana art. Actions are no-ops.
          </p>
          <p className="text-sm">
            <Link to="/login" className="text-accent hover:underline">
              Back to login
            </Link>
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <GalleryCard
            title="1. Product update"
            description="Apply flow → success checklist with Updates Applied."
            actions={[
              {
                label: 'Open product update',
                onClick: () => setOpen({ type: 'system-update', notice: SAMPLE_PRODUCT_UPDATE_NOTICE }),
              },
            ]}
          />
          <GalleryCard
            title="2. Maintenance"
            description="Scheduled downtime announcement."
            actions={[
              {
                label: 'Open maintenance',
                onClick: () => setOpen({ type: 'notice', notice: SAMPLE_MAINTENANCE_NOTICE }),
              },
            ]}
          />
          <GalleryCard
            title="3. Data backup"
            description="Backup reminder with Settings → Data guidance."
            actions={[
              {
                label: 'Open backup',
                onClick: () => setOpen({ type: 'notice', notice: SAMPLE_BACKUP_NOTICE }),
              },
            ]}
          />
          <GalleryCard
            title="4. Features marketplace"
            description="Discover optional capabilities."
            actions={[
              {
                label: 'Open marketplace',
                onClick: () => setOpen({ type: 'notice', notice: SAMPLE_MARKETPLACE_NOTICE }),
              },
            ]}
          />
          <GalleryCard
            title="General announcement"
            description="Pink header, marketing illustration, heading and paragraphs."
            actions={[
              {
                label: 'Open general announcement',
                onClick: () => setOpen({ type: 'notice', notice: SAMPLE_GENERAL_ANNOUNCEMENT_NOTICE }),
              },
            ]}
          />
          <GalleryCard
            title="5. Platform release"
            description="Platform admin what’s-new (green rocket)."
            actions={[{ label: 'Open platform release', onClick: () => setOpen({ type: 'whats-new' }) }]}
          />
          <GalleryCard
            title="Org release notes"
            description="Org-facing release changelog (blue rocket / product update)."
            actions={[
              {
                label: 'Open release notes',
                onClick: () => setOpen({ type: 'notice', notice: SAMPLE_RELEASE_NOTICE }),
              },
            ]}
          />
        </div>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-heading">Also available</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <GalleryCard
              title="Feature interest / enable"
              description="Checkbox flows (not the announcement shells)."
              actions={[
                {
                  label: 'Interest',
                  onClick: () => setOpen({ type: 'feature-launch', notice: SAMPLE_FEATURE_LAUNCH_NOTICE }),
                },
                {
                  label: 'Enable',
                  onClick: () => setOpen({ type: 'feature-enable', notice: SAMPLE_FEATURE_ENHANCEMENT_NOTICE }),
                },
              ]}
            />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-heading">Service issues</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SAMPLE_SERVICE_ISSUES.map(issue => (
              <div key={issue.kind} className="rounded-md bg-card shadow-[var(--shadow-card)] p-8 space-y-3">
                <p className="text-sm font-semibold text-heading">{issue.kind}</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setOpen({ type: 'service-modal', issue })}>
                    Modal
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setOpen({ type: 'service-full', issue })}>
                    Full page
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <ReleaseNoticeModal
        open={open.type === 'notice'}
        notice={open.type === 'notice' ? open.notice : null}
        onClose={close}
      />

      <SystemUpdateModal
        open={open.type === 'system-update'}
        notification={open.type === 'system-update' ? open.notice : null}
        onClose={close}
        onApply={async () => {
          await wait(900)
        }}
      />

      <FeatureLaunchInterestModal
        open={open.type === 'feature-launch'}
        notice={open.type === 'feature-launch' ? open.notice : null}
        loading={busy}
        onClose={close}
        onSubmitInterest={async () => {
          setBusy(true)
          await wait(600)
          setBusy(false)
          close()
        }}
      />

      <FeatureEnhancementModal
        open={open.type === 'feature-enable'}
        notice={open.type === 'feature-enable' ? open.notice : null}
        appliedKeys={['assistant_chat']}
        loading={busy}
        onClose={close}
        onEnable={async () => {
          setBusy(true)
          await wait(600)
          setBusy(false)
          close()
        }}
      />

      <PlatformWhatsNewModal open={open.type === 'whats-new'} onClose={close} />

      <ServiceIssueModal
        open={open.type === 'service-modal'}
        issue={open.type === 'service-modal' ? open.issue : null}
        onClose={close}
        onRefresh={close}
      />

      {open.type === 'service-full' ? (
        <ServiceIssueFullPage issue={open.issue} onRefresh={close} onBeforeHome={close} />
      ) : null}
    </div>
  )
}
