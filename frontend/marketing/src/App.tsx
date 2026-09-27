import deskUrl from '../../public/images/trading-desk.jpg'
import yardUrl from '../../public/images/hero-terminal.jpg'
import liftUrl from '../../public/images/tanker-lift.jpg'
import { Access } from './components/Access'
import { Accounting } from './components/Accounting'
import { Audience } from './components/Audience'
import { DemoForm } from './components/DemoForm'
import { Faq } from './components/Faq'
import { Features } from './components/Features'
import { Footer } from './components/Footer'
import { Hero } from './components/Hero'
import { HowItWorks } from './components/HowItWorks'
import { Industries } from './components/Industries'
import { Nav } from './components/Nav'
import { Outcomes } from './components/Outcomes'
import { PreviewSection } from './components/PreviewSection'
import { Problem } from './components/Problem'
import { Reports } from './components/Reports'
import { Testimonials } from './components/Testimonials'
import { VisualBreak } from './components/VisualBreak'
import { WhatIs } from './components/WhatIs'

export default function App() {
  return (
    <div id="top" className="min-h-dvh">
      <Nav />
      <main>
        <Hero />
        <Audience />
        <Problem />
        <VisualBreak
          src={yardUrl}
          title="Physical movement"
          caption="Track what actually moved — not only what was ordered."
          position="center"
        />
        <HowItWorks />
        <Testimonials />
        <WhatIs />
        <VisualBreak
          src={deskUrl}
          title="On the desk"
          caption="One book for purchases, sales, inventory, and today’s work."
          position="center 40%"
        />
        <Features />
        <PreviewSection />
        <Reports />
        <Access />
        <Industries />
        <Accounting />
        <VisualBreak
          src={liftUrl}
          title="From deal to delivery"
          caption="Keep commercial and operational workflow connected."
          position="68% center"
        />
        <Outcomes />
        <Faq />
        <DemoForm />
      </main>
      <Footer />
    </div>
  )
}
