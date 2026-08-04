"use client"

import Link from "next/link"
import Image from "next/image"
import { IBM_Plex_Sans, IBM_Plex_Mono, Bebas_Neue } from "next/font/google"
import { ScrambleText, ScrambleTextOnHover } from "@/components/landing/scramble-text"
import { useAuth } from "@clerk/react"
import { useState } from "react"
import { Loader2, Eye, EyeOff } from "lucide-react"
import { GoogleIcon, GithubIcon } from "@/components/auth/oauth-icons"
import { useEmailSignIn } from "@/hooks/use-email-sign-in"

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
  const { isSignedIn } = useAuth()
  const [showPassword, setShowPassword] = useState(false);
  const {
    ready,
    email,
    setEmail,
    password,
    setPassword,
    code,
    setCode,
    needsCode,
    error,
    loading,
    signInWithOAuth,
    submitPassword,
    submitCode,
    backToPassword,
  } = useEmailSignIn();

  const onSubmit = (submit: () => Promise<void>) => (e: React.FormEvent) => {
    e.preventDefault();
    void submit();
  };

  return (
    <div className={`landing-page relative min-h-screen bg-background text-foreground selection:bg-accent/25 ${ibmPlexSans.variable} ${bebasNeue.variable} ${ibmPlexMono.variable} font-sans antialiased overflow-x-hidden`}>
      
      {/* Dynamic Background */}
      <div className="fixed inset-0 z-0 pointer-events-none bg-background">
        {/* Subtle radial gradients for depth */}
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))]" />
        
        {/* Simple CSS-pulsing animated orbs (replaced heavy Framer Motion keyframes) */}
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] bg-accent/15 rounded-full blur-[100px] mix-blend-screen animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] bg-blue-600/10 rounded-full blur-[120px] mix-blend-screen animate-pulse" />

        {/* Textures */}
        <div className="grid-bg absolute inset-0 opacity-[0.07] mix-blend-overlay" />
        <div className="noise-overlay opacity-50" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Top Nav */}
        <nav className="flex items-center justify-between px-6 lg:px-12 py-4 border-b border-border/50 bg-background/50 backdrop-blur-md">
          <Link href="/" aria-label="Home" className="inline-flex h-8 w-8 items-center justify-center">
            <Image src="/icon.svg" alt="Project icon" width={32} height={32} priority />
          </Link>
          <div className="flex gap-6 text-[10px] uppercase tracking-widest font-mono text-muted-foreground">
            <Link href="/docs" className="hover:text-foreground transition-colors"><ScrambleTextOnHover text="Docs" /></Link>
            <Link href="https://github.com/phucvo-nino-nvd/aluci" className="hover:text-foreground transition-colors"><ScrambleTextOnHover text="GitHub" /></Link>
          </div>
        </nav>

        {/* Main Content Area */}
        <main className="flex-1 max-w-[1600px] w-full mx-auto border-x border-border/50 flex flex-col">
          
          {/* Top Half: Hero (Left) & Auth (Right) */}
          <div className="grid lg:grid-cols-2 border-b border-border/50">
            
            {/* Left Pane */}
            <div className="p-8 lg:p-16 xl:p-24 lg:border-r border-border/50 flex flex-col justify-center items-start">
              <h1 className="text-6xl sm:text-7xl lg:text-[5.5rem] xl:text-[6.5rem] 2xl:text-[8rem] tracking-tight text-foreground font-[family-name:var(--font-bebas)] leading-[0.85]">
                <span className="whitespace-nowrap">LEND SMARTER</span>
                <br />
                <span className="text-accent whitespace-nowrap">DECIDE FASTER.</span>
              </h1>
              
              <p className="mt-8 max-w-md font-mono text-sm text-muted-foreground leading-relaxed">
                Turn borrower documents, risk signals, and model outputs into a clear underwriting workspace built for faster, more confident lending decisions.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center gap-6 mt-12 w-full sm:w-auto">
                <Link 
                  href={isSignedIn ? "/dashboard" : "/login"}
                  className="group inline-flex items-center gap-3 border border-foreground/20 px-6 py-3 font-mono text-xs uppercase tracking-widest text-foreground hover:border-accent hover:text-accent transition-all duration-200"
                >
                  <ScrambleTextOnHover text={isSignedIn ? "Go to Dashboard" : "Get Started"} as="span" duration={0.6} />
                  <svg width="18" height="18" viewBox="0 0 27 27" fill="none" xmlns="http://www.w3.org/2000/svg" className="transition-transform duration-[400ms] ease-in-out group-hover:rotate-45">
                    <path d="M3.85715 3.85715H19.2857L23.0553 7.64066L17.5163 13.1595L22.8462 17.5055V23.1429H17.5055V13.1703L7.65696 22.9832L3.8874 19.2L13.9259 9.19781H3.85715V3.85715Z" fill="currentColor" />
                  </svg>
                </Link>
                
                <Link 
                  href="https://github.com/phucvo-nino-nvd/aluci"
                  className="font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors duration-200 border border-transparent px-6 py-3"
                >
                  View on GitHub
                </Link>
              </div>
            </div>

            {/* Right Pane: Log In Box */}
            <div className="p-8 lg:p-16 xl:p-24 flex items-center justify-center bg-background/20 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-transparent opacity-50" />
              
              <div className="w-full max-w-md bg-card/60 backdrop-blur-xl border border-border/50 rounded-none p-8 sm:p-10 shadow-2xl relative z-10">
                
                {/* Title */}
                <h2 className="font-[family-name:var(--font-bebas)] text-4xl tracking-wide text-foreground mb-1 text-center">LOG IN</h2>
                <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-8 text-center">
                  Enter details to access workspace
                </p>

                {needsCode ? (
                <form onSubmit={onSubmit(submitCode)} className="space-y-4 animate-in fade-in">
                  <div>
                    <label className="font-mono text-xs uppercase tracking-widest text-foreground mb-1.5 block">Verification code</label>
                    <p className="text-xs text-muted-foreground mb-3">
                      This device is not recognised yet. We sent a code to{" "}
                      <span className="font-semibold text-foreground">{email}</span>
                    </p>
                    <input
                      type="text"
                      value={code}
                      onChange={e => setCode(e.target.value)}
                      required
                      autoFocus
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="Enter 6-digit code"
                      className="w-full bg-secondary border border-border focus:border-accent rounded-none h-12 px-3 text-foreground font-mono text-sm focus:ring-1 focus:ring-accent transition-colors outline-none placeholder:text-muted-foreground/40"
                    />
                  </div>

                  {error && (
                    <p className="text-destructive font-mono text-xs uppercase tracking-widest font-semibold bg-destructive/10 p-2 border border-destructive">
                      {error}
                    </p>
                  )}

                  <button type="submit" disabled={loading || !ready} className="w-full bg-accent hover:opacity-90 text-accent-foreground h-12 rounded-none font-mono text-sm uppercase tracking-widest transition-opacity mt-4 flex items-center justify-center disabled:opacity-50">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & Continue"}
                  </button>

                  <button type="button" onClick={backToPassword} className="w-full font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
                    Back to Log in
                  </button>
                </form>
                ) : (
                <>
                {/* Log in with */}
                <div className="relative flex items-center mb-6">
                  <div className="flex-grow border-t border-border/50"></div>
                  <span className="mx-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">Log in with</span>
                  <div className="flex-grow border-t border-border/50"></div>
                </div>

                {/* OAuth Buttons */}
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <button onClick={() => signInWithOAuth("oauth_google")} className="flex items-center justify-center gap-3 py-3 border border-border bg-secondary hover:border-accent hover:bg-accent hover:text-accent-foreground transition-colors rounded-none group">
                    <GoogleIcon className="w-4 h-4 group-hover:opacity-80" />
                    <span className="font-mono text-xs uppercase tracking-widest group-hover:text-accent-foreground">Google</span>
                  </button>
                  <button onClick={() => signInWithOAuth("oauth_github")} className="flex items-center justify-center gap-3 py-3 border border-border bg-secondary hover:border-accent hover:bg-accent hover:text-accent-foreground transition-colors rounded-none group">
                    <GithubIcon className="w-4 h-4" />
                    <span className="font-mono text-xs uppercase tracking-widest group-hover:text-accent-foreground">GitHub</span>
                  </button>
                </div>

                {/* Divider: Your email address */}
                <div className="relative flex items-center mb-6">
                  <div className="flex-grow border-t border-border/50"></div>
                  <span className="mx-4 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">{`your email address`}</span>
                  <div className="flex-grow border-t border-border/50"></div>
                </div>

                {/* Form */}
                <form onSubmit={onSubmit(submitPassword)} className="space-y-4">
                  <div>
                    <label className="font-mono text-xs uppercase tracking-widest text-foreground mb-1.5 block">Email address</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="name@example.com" className="w-full bg-secondary border border-border focus:border-accent rounded-none h-12 px-3 text-foreground font-mono text-sm focus:ring-1 focus:ring-accent transition-colors outline-none placeholder:text-muted-foreground/40" />
                  </div>
                  <div>
                    <label className="font-mono text-xs uppercase tracking-widest text-foreground mb-1.5 block">Password</label>
                    <div className="relative">
                      <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;" className="w-full bg-secondary border border-border focus:border-accent rounded-none h-12 pl-3 pr-10 text-foreground font-mono text-sm focus:ring-1 focus:ring-accent transition-colors outline-none placeholder:text-muted-foreground/40" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-center mt-2">
                    <Link href="/forgot-password" className="font-mono text-xs uppercase tracking-widest text-accent hover:text-foreground transition-colors">Forgot Password?</Link>
                  </div>

                  {error && (
                    <p className="text-destructive font-mono text-xs uppercase tracking-widest font-semibold bg-destructive/10 p-2 border border-destructive">
                      {error}
                    </p>
                  )}

                  <button type="submit" disabled={loading || !ready} className="w-full bg-accent hover:opacity-90 text-accent-foreground h-12 rounded-none font-mono text-sm uppercase tracking-widest transition-opacity mt-4 flex items-center justify-center disabled:opacity-50">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In"}
                  </button>
                </form>
                </>
                )}

                <div className="mt-8 text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  Don&apos;t have an account?{" "}
                  <Link href="/register" className="text-accent hover:text-foreground font-semibold transition-colors">
                    Sign up
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Half: Features Grid */}
          <div className="grid lg:grid-cols-3">
            <div className="p-8 lg:p-12 border-b lg:border-b-0 lg:border-r border-border/50 flex flex-col md:flex-row gap-6">
              <div className="shrink-0 text-foreground">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              </div>
              <div className="space-y-3 pt-1">
                <h3 className="font-semibold text-foreground text-lg">Decision-ready insights</h3>
                <p className="text-xs text-muted-foreground leading-relaxed font-[family-name:var(--font-ibm-plex-mono)]">
                  Summarize applicant context, highlight risk patterns, and surface the next best action without digging through scattered files.
                </p>
              </div>
            </div>
            
            <div className="p-8 lg:p-12 border-b lg:border-b-0 lg:border-r border-border/50 flex flex-col md:flex-row gap-6">
              <div className="shrink-0 text-foreground">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
              </div>
              <div className="space-y-3 pt-1">
                <h3 className="font-semibold text-foreground text-lg">Auditable risk signals</h3>
                <p className="text-xs text-muted-foreground leading-relaxed font-[family-name:var(--font-ibm-plex-mono)]">
                  Keep every recommendation grounded in model outputs, document evidence, and explainable factors your team can review.
                </p>
              </div>
            </div>
            
            <div className="p-8 lg:p-12 flex flex-col md:flex-row gap-6">
              <div className="shrink-0 text-foreground">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
              </div>
              <div className="space-y-3 pt-1">
                <h3 className="font-semibold text-foreground text-lg">Pipeline command center</h3>
                <p className="text-xs text-muted-foreground leading-relaxed font-[family-name:var(--font-ibm-plex-mono)]">
                  Track applicants from intake to approval with one workspace for documents, AI notes, status changes, and team handoff.
                </p>
              </div>
            </div>
          </div>
        </main>
        
        {/* Footer */}
        <footer className="border-t border-border/50 bg-background">
          <div className="max-w-[1600px] mx-auto px-6 lg:px-12 py-6 flex flex-col sm:flex-row items-center justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <div>© {new Date().getFullYear()}. All rights reserved.</div>
            <div className="flex gap-6 mt-4 sm:mt-0">
              <span className="text-foreground/80">AI Loan Underwriting Copilot</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
