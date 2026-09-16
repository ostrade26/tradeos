import type { ReactNode } from 'react'

interface DeliveryFormSectionProps {
  title: string
  description?: string
  children: ReactNode
}

/** Grouped block for delivery modals — title, optional hint, content. */
export function DeliveryFormSection({ title, description, children }: DeliveryFormSectionProps) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-heading">{title}</h3>
        {description ? (
          <p className="text-xs text-muted mt-0.5 leading-relaxed">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  )
}
