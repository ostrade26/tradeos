import { Eye, Shield, UserCog } from 'lucide-react'
import { Reveal } from './Reveal'
import { SectionHeading } from './SectionHeading'

const roles = [
  {
    icon: UserCog,
    title: 'Admin',
    body: 'View and manage business operations within assigned permissions — people, seats, and the live register.',
  },
  {
    icon: Shield,
    title: 'Operator',
    body: 'Handle day-to-day transactions without unrestricted administrative access.',
  },
  {
    icon: Eye,
    title: 'View only',
    body: 'See relevant business information without modifying transactions.',
  },
]

export function Access() {
  return (
    <section id="access" className="border-t border-gray-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <Reveal>
          <SectionHeading eyebrow="Teams and control" title="Give every team member the right level of access.">
            <p>
              Your trade data stays structured, traceable and controlled. Organisations are isolated
              from each other. Changes land on an audit trail.
            </p>
          </SectionHeading>
        </Reveal>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {roles.map((role, i) => (
            <Reveal key={role.title} delay={i * 60}>
              <article className="lift-card h-full rounded-xl border border-gray-200 bg-body p-6">
                <span className="icon-pop flex h-10 w-10 items-center justify-center rounded-lg bg-accent-muted text-accent">
                  <role.icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-4 text-base font-semibold text-heading">{role.title}</h3>
                <p className="mt-2 text-sm text-muted leading-relaxed">{role.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
