"use client"

import Link from "next/link"
import Image from "next/image"
import { IBM_Plex_Sans, IBM_Plex_Mono, Bebas_Neue } from "next/font/google"
import { motion } from "framer-motion"
import { ScrambleText, ScrambleTextOnHover } from "@/components/landing/scramble-text"
import { useAuth, useClerk, useSignIn } from "@clerk/nextjs"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Eye, EyeOff } from "lucide-react"

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

const GoogleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const GithubIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.6.113.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
  </svg>
);

export default function LandingPage() {
  const { isSignedIn } = useAuth()
  
  // Login Form States
  const clerk = useClerk();
  const { signIn } = useSignIn();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    if (!clerk.loaded) return;
    if (isSignedIn) { router.push("/dashboard"); return; }
    try {
      await clerk.client.signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/onboarding",
      });
    } catch (err: any) {
      setError(err.errors?.[0]?.message || "Something went wrong.");
    }
  };

  const handleGithubSignIn = async () => {
    if (!clerk.loaded) return;
    if (isSignedIn) { router.push("/dashboard"); return; }
    try {
      await clerk.client.signIn.authenticateWithRedirect({
        strategy: "oauth_github",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/onboarding",
      });
    } catch (err: any) {
      setError(err.errors?.[0]?.message || "Something went wrong.");
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clerk.loaded) return;
    setLoading(true);
    setError("");

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Please enter your email address.");
      setLoading(false);
      return;
    }

    const { error: signInError } = await signIn.password({
      emailAddress: trimmedEmail,
      password,
    });

    if (signInError) {
      const clerkError = signInError.errors?.[0];
      if (clerkError?.code === "form_identifier_not_found") {
        setError("No account found with this email. Please sign up first.");
      } else if (clerkError?.code === "form_password_incorrect" || clerkError?.code === "form_password_pwned") {
        setError("Incorrect password. Please try again.");
      } else {
        setError(clerkError?.longMessage || clerkError?.message || "Invalid email or password.");
      }
      setLoading(false);
      return;
    }

    if (signIn.status === "complete") {
      await signIn.finalize({
        navigate: ({ decorateUrl }) => {
          const url = decorateUrl("/onboarding");
          if (url.startsWith("http")) {
            window.location.href = url;
          } else {
            router.push(url);
          }
        },
      });
    } else {
      setError("Sign in requires further steps.");
    }
    setLoading(false);
  };

  return (
    <div className={`landing-page relative min-h-screen bg-background text-foreground selection:bg-accent/25 ${ibmPlexSans.variable} ${bebasNeue.variable} ${ibmPlexMono.variable} font-sans antialiased overflow-x-hidden`}>
      
      {/* Dynamic Background */}
      <div className="fixed inset-0 z-0 pointer-events-none bg-background">
        {/* Subtle radial gradients for depth */}
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))]" />
        
        {/* Animated glowing orbs */}
        <motion.div 
          animate={{ x: [0, 50, -50, 0], y: [0, -30, 30, 0], scale: [1, 1.1, 0.9, 1] }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] bg-accent/15 rounded-full blur-[100px] mix-blend-screen"
        />
        <motion.div 
          animate={{ x: [0, -50, 50, 0], y: [0, 50, -50, 0], scale: [1, 1.2, 0.8, 1] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] bg-blue-600/10 rounded-full blur-[120px] mix-blend-screen"
        />

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
            <Link href="https://github.com/phucvo-nino-nvd/ai-loan-underwriting-copilot" className="hover:text-foreground transition-colors"><ScrambleTextOnHover text="GitHub" /></Link>
          </div>
        </nav>

        {/* Main Content Area */}
        <main className="flex-1 max-w-[1600px] w-full mx-auto border-x border-border/50 flex flex-col">
          
          {/* Top Half: Hero (Left) & Auth (Right) */}
          <div className="grid lg:grid-cols-2 border-b border-border/50">
            
            {/* Left Pane */}
            <div className="p-8 lg:p-16 xl:p-24 lg:border-r border-border/50 flex flex-col justify-center items-start">
              <h1 className="text-6xl sm:text-7xl xl:text-[8rem] tracking-tight text-foreground font-[family-name:var(--font-bebas)] leading-[0.85]">
                LEND SMARTER
                <br />
                <span className="text-accent">DECIDE FASTER.</span>
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
                  href="https://github.com/phucvo-nino-nvd/ai-loan-underwriting-copilot"
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

                {/* Log in with */}
                <div className="relative flex items-center mb-6">
                  <div className="flex-grow border-t border-border/50"></div>
                  <span className="mx-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">Log in with</span>
                  <div className="flex-grow border-t border-border/50"></div>
                </div>

                {/* OAuth Buttons */}
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <button onClick={handleGoogleSignIn} className="relative flex items-center justify-center gap-3 py-3 border border-accent/50 bg-accent/10 hover:bg-accent hover:text-accent-foreground transition-colors rounded-none group">
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-background px-1 border border-accent/50 font-mono text-[8px] uppercase tracking-widest text-accent group-hover:bg-accent group-hover:text-accent-foreground group-hover:border-transparent transition-colors whitespace-nowrap">LAST USED</span>
                    <GoogleIcon className="w-4 h-4 group-hover:opacity-80" />
                    <span className="font-mono text-xs uppercase tracking-widest group-hover:text-accent-foreground">Google</span>
                  </button>
                  <button onClick={handleGithubSignIn} className="flex items-center justify-center gap-3 py-3 border border-border bg-secondary hover:border-accent hover:bg-accent hover:text-accent-foreground transition-colors rounded-none group">
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
                <form onSubmit={handleEmailSignIn} className="space-y-4">
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

                  <button type="submit" disabled={loading || !clerk.loaded} className="w-full bg-accent hover:opacity-90 text-accent-foreground h-12 rounded-none font-mono text-sm uppercase tracking-widest transition-opacity mt-4 flex items-center justify-center disabled:opacity-50">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In"}
                  </button>
                </form>

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
