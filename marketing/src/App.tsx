import { DemoForm } from './components/DemoForm'
import { Features } from './components/Features'
import { Footer } from './components/Footer'
import { Hero } from './components/Hero'
import { HowItWorks } from './components/HowItWorks'
import { Nav } from './components/Nav'
import { PreviewSection } from './components/PreviewSection'
import { Problem } from './components/Problem'

export default function App() {
  return (
    <div id="top" className="min-h-dvh">
      <Nav />
      <main>
        <Hero />
        <Problem />
        <Features />
        <HowItWorks />
        <PreviewSection />
        <DemoForm />
      </main>
      <Footer />
    </div>
  )
}
