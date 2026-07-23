"use client";

import { useClerk, useSignIn } from "@clerk/nextjs";
import { Bebas_Neue, IBM_Plex_Mono } from "next/font/google";
import Link from "next/link";
import { ArrowLeft, Loader2, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

const bebasNeue = Bebas_Neue({ weight: "400", subsets: ["latin"], variable: "--font-bebas" });
const ibmPlexMono = IBM_Plex_Mono({ weight: ["400", "500"], subsets: ["latin"], variable: "--font-ibm-plex-mono" });

const GoogleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

export default function LoginPage() {
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
    } else if (signIn.status === "needs_second_factor") {
      setError("Two-factor authentication required. Please use Google OAuth.");
    } else {
      setError("Sign in requires further steps. Please use Google OAuth or check configuration.");
    }

    setLoading(false);
  };

  return (
    <div className={`landing-page ${bebasNeue.variable} ${ibmPlexMono.variable} min-h-screen relative flex items-center justify-center font-sans overflow-hidden bg-background`}>
      <div id="clerk-captcha"></div>
      <div className="noise-overlay" aria-hidden="true" />
      <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />

      <Link href="/" className="absolute top-6 left-6 text-muted-foreground hover:text-foreground flex items-center gap-2 font-[family-name:var(--font-ibm-plex-mono)] text-xs uppercase tracking-widest transition-colors z-20">
        <ArrowLeft className="w-4 h-4" />
        Back to Index
      </Link>

      <div className="relative z-10 w-full max-w-[850px] min-h-[550px] flex rounded-none bg-card border border-border/50 mx-4 shadow-2xl">
        
        <div className="hidden md:flex flex-col justify-between w-5/12 p-10 relative overflow-hidden bg-accent text-accent-foreground">
          <div className="relative z-10 flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 3h5v1H3V3z M3 4h1v1H3V4z M7 4h1v1H7V4z M2 5h1v1H2V5z M8 6h1v1H8V6z M5 6h1v3H5V6z M4 7h3v1H4V7z" fill="currentColor" />
            </svg>
            <span className="font-[family-name:var(--font-ibm-plex-mono)] text-[10px] uppercase tracking-widest font-semibold">
              System Login
            </span>
          </div>

          <div className="relative z-10">
            <h1 className="font-[family-name:var(--font-bebas)] text-6xl tracking-wide leading-none mb-4">
              WELCOME <br /> BACK.
            </h1>
            <p className="font-sans text-sm font-medium leading-relaxed max-w-[250px] opacity-80">
              Get every model, every tool, in one intelligent underwriting workflow.
            </p>
          </div>

          <div className="relative z-10 font-[family-name:var(--font-ibm-plex-mono)] text-[10px] uppercase tracking-widest font-semibold opacity-60">
            © 2026. All rights reserved.
          </div>
        </div>

        <div className="w-full md:w-7/12 flex flex-col justify-center p-8 sm:p-12 bg-card">
          <div className="w-full max-w-[360px] mx-auto brutalist-clerk">
            <h2 className="font-[family-name:var(--font-bebas)] text-4xl tracking-wide text-foreground mb-1">
              Sign in
            </h2>
            <p className="font-[family-name:var(--font-ibm-plex-mono)] text-xs text-muted-foreground uppercase tracking-widest mb-8">
              Enter details to access workspace
            </p>

            <div className="flex flex-col gap-4">
              <button
                onClick={handleGoogleSignIn}
                type="button"
                className="w-full bg-secondary hover:bg-foreground border border-border text-foreground hover:text-background h-11 rounded-none flex items-center justify-center font-[family-name:var(--font-ibm-plex-mono)] text-xs uppercase tracking-widest font-semibold transition-colors"
              >
                <GoogleIcon className="w-4 h-4 mr-2" />
                Continue with Google
              </button>

              <div className="flex items-center gap-3 my-2 opacity-50">
                <div className="flex-1 h-px bg-border"></div>
                <span className="font-[family-name:var(--font-ibm-plex-mono)] text-[10px] uppercase tracking-widest text-muted-foreground">Or</span>
                <div className="flex-1 h-px bg-border"></div>
              </div>

              <form onSubmit={handleEmailSignIn} className="flex flex-col gap-4">
                <div>
                  <label className="font-[family-name:var(--font-ibm-plex-mono)] text-xs uppercase tracking-widest text-foreground mb-1.5 block">Email address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full bg-secondary border border-border focus:border-accent rounded-none h-11 px-3 text-foreground font-[family-name:var(--font-ibm-plex-mono)] text-sm focus:ring-1 focus:ring-accent transition-colors outline-none"
                  />
                </div>
                
                <div>
                  <label className="font-[family-name:var(--font-ibm-plex-mono)] text-xs uppercase tracking-widest text-foreground mb-1.5 block">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full bg-secondary border border-border focus:border-accent rounded-none h-11 pl-3 pr-10 text-foreground font-[family-name:var(--font-ibm-plex-mono)] text-sm focus:ring-1 focus:ring-accent transition-colors outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="text-destructive font-[family-name:var(--font-ibm-plex-mono)] text-[10px] uppercase tracking-widest font-semibold bg-destructive/10 p-2 border border-destructive">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading || !clerk.loaded}
                  className="w-full bg-accent hover:opacity-90 text-accent-foreground h-11 rounded-none font-[family-name:var(--font-ibm-plex-mono)] text-xs uppercase tracking-widest transition-opacity mt-2 flex items-center justify-center disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign in"}
                </button>
              </form>
            </div>

            <div className="mt-8 text-center font-[family-name:var(--font-ibm-plex-mono)] text-xs text-muted-foreground uppercase tracking-widest">
              Don't have an account?{" "}
              <Link href="/register" className="text-foreground font-semibold hover:text-accent transition-colors">
                Sign up
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
