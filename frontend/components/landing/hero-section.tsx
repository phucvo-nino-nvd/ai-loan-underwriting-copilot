"use client"

import { useEffect, useRef } from "react"
import { useAuth } from "@clerk/nextjs"
import Link from "next/link"
import { ScrambleTextOnHover } from "@/components/landing/scramble-text"
import { SplitFlapText, SplitFlapMuteToggle, SplitFlapAudioProvider } from "@/components/landing/split-flap-text"
import { AnimatedNoise } from "@/components/landing/animated-noise"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

export function HeroSection() {
  const { isSignedIn } = useAuth()
  const sectionRef = useRef<HTMLElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!sectionRef.current || !contentRef.current) return

    const ctx = gsap.context(() => {
      gsap.to(contentRef.current, {
        y: -100,
        opacity: 0,
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top top",
          end: "bottom top",
          scrub: 1,
        },
      })
    }, sectionRef)

    return () => ctx.revert()
  }, [])

  return (
    <section ref={sectionRef} id="hero" className="relative min-h-screen flex items-center pl-6 md:pl-28 pr-6 md:pr-12">
      <AnimatedNoise opacity={0.03} />

      {/* Left vertical labels */}
      <div className="absolute left-4 md:left-6 top-1/2 -translate-y-1/2">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground -rotate-90 origin-left block whitespace-nowrap">
          SWIN
        </span>
      </div>

      {/* Main content */}
      <div ref={contentRef} className="flex-1 w-full">
        <SplitFlapAudioProvider>
          <div className="relative ml-4 md:ml-6">
            <SplitFlapText text="FORESIGHT" speed={80} />
            <div className="mt-4">
              <SplitFlapMuteToggle />
            </div>
          </div>
        </SplitFlapAudioProvider>

        <h2 className="font-[family-name:var(--font-bebas)] text-muted-foreground/60 text-[clamp(1rem,3vw,2rem)] mt-4 tracking-wide">
          AI-Powered Loan Assessment
        </h2>

        <p className="mt-12 max-w-md font-mono text-sm text-muted-foreground leading-relaxed">
          Intelligent underwriting that evaluates risk, detects patterns, and accelerates
          lending decisions — so you can focus on what matters.
        </p>

        <div className="mt-16 flex items-center gap-8">
          <Link
            href={isSignedIn ? "/dashboard" : "/login"}
            className="group inline-flex items-center gap-3 border border-foreground/20 px-6 py-3 font-mono text-xs uppercase tracking-widest text-foreground hover:border-accent hover:text-accent transition-all duration-200"
          >
            <ScrambleTextOnHover text={isSignedIn ? "Go to Dashboard" : "Get Started"} as="span" duration={0.6} />
            <svg
              width="18"
              height="18"
              viewBox="0 0 27 27"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="transition-transform duration-[400ms] ease-in-out group-hover:rotate-45"
            >
              <path
                d="M3.85715 3.85715H19.2857L23.0553 7.64066L17.5163 13.1595L22.8462 17.5055V23.1429H17.5055V13.1703L7.65696 22.9832L3.8874 19.2L13.9259 9.19781H3.85715V3.85715Z"
                fill="currentColor"
              />
            </svg>
          </Link>
          <a
            href="#signals"
            className="font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors duration-200"
          >
            Latest Signals
          </a>
        </div>
      </div>

      {/* Floating info tag */}
      <div className="absolute bottom-8 right-8 md:bottom-12 md:right-12">
        <div className="border border-border px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          v.01 / AI Underwriting
        </div>
      </div>
    </section>
  )
}
