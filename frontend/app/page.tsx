import { IBM_Plex_Sans, IBM_Plex_Mono, Bebas_Neue } from "next/font/google"
import { HeroSection } from "@/components/landing/hero-section"
import { SignalsSection } from "@/components/landing/signals-section"
import { WorkSection } from "@/components/landing/work-section"
import { PrinciplesSection } from "@/components/landing/principles-section"
import { ColophonSection } from "@/components/landing/colophon-section"
import { SideNav } from "@/components/landing/side-nav"
import { SmoothScroll } from "@/components/landing/smooth-scroll"

const ibmPlexSans = IBM_Plex_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-ibm-plex-sans",
})
const ibmPlexMono = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-ibm-plex-mono",
})
const bebasNeue = Bebas_Neue({ weight: "400", subsets: ["latin"], variable: "--font-bebas" })

export default function LandingPage() {
  return (
    <div
      className={`landing-page ${ibmPlexSans.variable} ${bebasNeue.variable} ${ibmPlexMono.variable} font-sans antialiased overflow-x-hidden`}
    >
      <div className="noise-overlay" aria-hidden="true" />
      <SmoothScroll>
        <main className="relative min-h-screen">
          <SideNav />
          <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />

          <div className="relative z-10">
            <HeroSection />
            <SignalsSection />
            <WorkSection />
            <PrinciplesSection />
            <ColophonSection />
          </div>
        </main>
      </SmoothScroll>
    </div>
  )
}
