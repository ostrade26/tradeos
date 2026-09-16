/** Plan marketing copy for org settings (keyed by subscription_plans.slug). */
const PLAN_FEATURES: Record<string, string[]> = {
  starter: [
    'Purchase & sales registers',
    'Lift register and inventory',
    'Directory, contracts, and activity',
    'Add Operator or Viewer seats after approval',
  ],
  professional: [
    'Everything in Starter',
    'Analytics and report exports',
    'Contracts register at scale',
    'Add-on Operator and Viewer seats',
    'Off-platform billing with Tradeal',
  ],
}

export function planFeaturesForSlug(slug: string | undefined): string[] {
  if (!slug) return PLAN_FEATURES.starter ?? []
  return PLAN_FEATURES[slug] ?? PLAN_FEATURES.starter ?? []
}
