import type { UserNotification } from '../../api/platformApi'
import type { ServiceIssueKind, ServiceIssueView } from '../../lib/serviceIssue'

function notice(
  partial: Pick<UserNotification, 'id' | 'kind' | 'title' | 'body' | 'payload'> & {
    feature_key?: string
  },
): UserNotification {
  return {
    organisation_id: 1,
    recipient_user_id: 1,
    href: '',
    read_at: null,
    unread: true,
    created_at: new Date().toISOString(),
    ...partial,
  }
}

const changelog = (entries: { category: string; title: string; detail: string; feature_key?: string }[]) =>
  JSON.stringify(entries)

/** 1. Product update (apply flow / success) */
export const SAMPLE_PRODUCT_UPDATE_NOTICE = notice({
  id: 9005,
  kind: 'product_update',
  title: 'Product update ready',
  body: 'A few improvements are ready to apply on this account.',
  payload: {
    version: '1.0.0',
    feature_key: 'assistant_chat',
    apply_scope: 'user',
    changelog: changelog([
      {
        category: 'feature_enhancement',
        title: 'Assistant answers platform questions',
        detail: 'Marketplace feature · Ask about organisations, seats, and releases from the chat panel.',
        feature_key: 'assistant_chat',
      },
      {
        category: 'improvement',
        title: 'Inbox seat request details and status badges',
        detail: 'Org and Tradeal admins see seat type, amount, and Approved/Rejected in the inbox side panel.',
      },
    ]),
  },
  feature_key: 'assistant_chat',
})

/** 2. Maintenance */
export const SAMPLE_MAINTENANCE_NOTICE = notice({
  id: 9003,
  kind: 'maintenance',
  title: 'Maintenance Scheduled',
  body: 'Tradeal may be briefly unavailable Saturday\nThe system may be temporarily unavailable during the maintenance window. We apologize for the inconvenience and appreciate your understanding.',
  payload: {
    window: 'Saturday 24 Sep 02:00 – 03:00 IST.',
  },
})

/** 3. Data backup */
export const SAMPLE_BACKUP_NOTICE = notice({
  id: 9002,
  kind: 'backup_reminder',
  title: 'Backup your data',
  body: 'Make sure all important data, documents, and updates are saved and backed up in advance.\nExport a backup from Settings → Data so you can restore if something goes wrong.',
  payload: {
    deadline: 'Please secure your important data before Saturday.',
  },
})

/** 4. Features marketplace */
export const SAMPLE_MARKETPLACE_NOTICE = notice({
  id: 9004,
  kind: 'announcement',
  title: 'Features Marketplace',
  body: 'Browse available features, learn what they offer, and enable the ones that best fit your business needs.',
  payload: {},
})

/** 5. Platform release (org release notes list) */
export const SAMPLE_RELEASE_NOTICE = notice({
  id: 9001,
  kind: 'release_notes',
  title: 'Tradeal 1.1.0 is live',
  body: 'Release notes for this version.',
  payload: {
    version: '1.1.0',
    changelog: changelog([
      {
        category: 'improvement',
        title: 'Inbox seat request details and status badges',
        detail: 'Org and Tradeal admins see seat type, amount, and Approved/Rejected in the inbox side panel.',
      },
      {
        category: 'improvement',
        title: 'Faster Releases refresh',
        detail: 'Opening Releases from the bell updates the list promptly.',
      },
    ]),
  },
})

export const SAMPLE_FEATURE_LAUNCH_NOTICE = notice({
  id: 9006,
  kind: 'feature_launch',
  title: 'New optional features',
  body: 'Tell us which capabilities you want for this organisation.',
  payload: {
    feature_keys: 'assistant_chat\ncustom_branding',
    items: 'Tradeal Assistant\nCustom branding',
    changelog: changelog([
      {
        category: 'new_feature',
        title: 'Tradeal Assistant',
        detail: 'Ask operational questions without leaving the register.',
        feature_key: 'assistant_chat',
      },
      {
        category: 'new_feature',
        title: 'Custom branding',
        detail: 'Accent colour and org appearance controls.',
        feature_key: 'custom_branding',
      },
    ]),
  },
})

export const SAMPLE_FEATURE_ENHANCEMENT_NOTICE = notice({
  id: 9007,
  kind: 'feature_launch',
  title: 'Enable new capabilities',
  body: 'Pick features to turn on for this organisation.',
  payload: {
    feature_keys: 'assistant_chat\ncustom_branding\nlift_scheduler',
    items: 'Tradeal Assistant\nCustom branding\nLift scheduler',
    changelog: changelog([
      {
        category: 'feature_enhancement',
        title: 'Tradeal Assistant',
        detail: 'Already available on some licences.',
        feature_key: 'assistant_chat',
      },
      {
        category: 'feature_enhancement',
        title: 'Custom branding',
        detail: 'Accent colour for your workspace.',
        feature_key: 'custom_branding',
      },
      {
        category: 'feature_enhancement',
        title: 'Lift scheduler',
        detail: 'Plan upcoming lifts on a calendar.',
        feature_key: 'lift_scheduler',
      },
    ]),
  },
})

/** @deprecated use SAMPLE_MARKETPLACE_NOTICE */
export const SAMPLE_ANNOUNCEMENT_NOTICE = SAMPLE_MARKETPLACE_NOTICE

export const SAMPLE_SERVICE_ISSUES: ServiceIssueView[] = (
  [
    'no_internet',
    'connectivity',
    'database',
    'not_found',
    'server',
    'generic',
  ] as ServiceIssueKind[]
).map((kind, index) => ({
  id: `dev-issue-${kind}`,
  kind,
  title:
    kind === 'no_internet'
      ? 'No internet connection'
      : kind === 'connectivity'
        ? 'Tradeal is unreachable'
        : kind === 'database'
          ? 'Data could not be loaded'
          : kind === 'not_found'
            ? 'This page is not available'
            : kind === 'server'
              ? 'Something went wrong on our side'
              : 'Something went wrong',
  message: `Sample ${kind} message for local preview (#${index + 1}).`,
  hint: 'This is a local gallery — Refresh does not call the API.',
  httpStatus: kind === 'not_found' ? 404 : kind === 'server' ? 500 : undefined,
  requestPath: kind === 'database' ? '/api/v1/state' : '/api/v1/health',
  technical: `dev gallery · kind=${kind}`,
}))
