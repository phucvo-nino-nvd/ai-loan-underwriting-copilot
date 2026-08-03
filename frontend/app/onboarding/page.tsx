"use client";

import { useUser } from "@clerk/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { patchSettings } from "@/lib/settings";
import { BitmapChevron } from "@/components/landing/bitmap-chevron";

export default function OnboardingPage() {
  const { user, isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState("analyst");
  const [timezone, setTimezone] = useState("utc");
  const [provider, setProvider] = useState("openai/gpt-oss-120b");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const needsPassword = isLoaded && !!user && !user.passwordEnabled;

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace("/login");
      return;
    }
    if (user?.unsafeMetadata?.hasOnboarded) {
      router.replace("/dashboard");
    }
  }, [isLoaded, isSignedIn, user, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || saving) return;

    if (needsPassword) {
      if (password.length < 8) {
        setSubmitError("Password must be at least 8 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setSubmitError("Passwords do not match.");
        return;
      }
    }

    setSaving(true);
    setSubmitError("");
    try {
      if (needsPassword) {
        await user.updatePassword({ newPassword: password });
      }

      await user.update({
        unsafeMetadata: { hasOnboarded: true, firstName, lastName, role, timezone },
      });
      await user.reload();

      patchSettings({ aiConfig: { preferredModel: provider } });

      router.replace("/dashboard");
    } catch (err: any) {
      setSubmitError(err?.errors?.[0]?.longMessage || err?.message || "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (user?.unsafeMetadata?.hasOnboarded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          <div className="w-11 h-11 flex items-center justify-center mb-4 text-foreground">
            <BitmapChevron className="w-7 h-7" />
          </div>
          <h1 className="mt-5 text-xl font-semibold tracking-tight text-foreground">Welcome to AI Loan Underwriting Copilot</h1>
          <p className="mt-1 text-sm text-muted-foreground">Set up your profile to get started</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="firstName" className="text-sm font-medium text-foreground">First Name</label>
              <input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className="w-full h-9 px-3 bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-accent transition-all duration-200"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="lastName" className="text-sm font-medium text-foreground">Last Name</label>
              <input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                className="w-full h-9 px-3 bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-accent transition-all duration-200"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="role" className="text-sm font-medium text-foreground">Role</label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full h-9 px-3 bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-accent transition-all duration-200"
              >
                <option value="admin">Administrator</option>
                <option value="manager">Underwriting Manager</option>
                <option value="analyst">Loan Analyst</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="timezone" className="text-sm font-medium text-foreground">Timezone</label>
              <select
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full h-9 px-3 bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-accent transition-all duration-200"
              >
                <option value="pst">Pacific Time (PT)</option>
                <option value="mst">Mountain Time (MT)</option>
                <option value="cst">Central Time (CT)</option>
                <option value="est">Eastern Time (ET)</option>
                <option value="utc">UTC</option>
              </select>
            </div>
          </div>

          {needsPassword && (
            <div className="pt-4 border-t border-border/50">
              <h3 className="text-sm font-medium text-foreground">Set a password</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                You signed up with a social account. Add a password so you can also sign in with your email.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium text-foreground">Password</label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      className="w-full h-9 pl-3 pr-9 bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-accent transition-all duration-200"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">Confirm Password</label>
                  <input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className="w-full h-9 px-3 bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-accent transition-all duration-200"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-border/50">
            <h3 className="text-sm font-medium text-foreground mb-4">AI Configuration (Optional)</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="provider" className="text-sm font-medium text-foreground">AI Provider</label>
                  <select
                    id="provider"
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    className="w-full h-9 px-3 bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-accent transition-all duration-200"
                  >
                     <option value="openai/gpt-oss-120b">GPT-OSS 120B</option>
                     <option value="openai/gpt-oss-20b">GPT-OSS 20B</option>
                     <option value="deepseek/deepseek-v4-flash">DeepSeek V4 Flash</option>
                   </select>
              </div>


            </div>
          </div>

          {submitError && (
            <p className="text-destructive font-mono text-xs leading-relaxed bg-destructive/10 p-3 border border-destructive/50 rounded-lg">
              {submitError}
            </p>
          )}

          <button
            type="submit"
            disabled={saving || !firstName || !lastName || (needsPassword && (!password || !confirmPassword))}
            className="w-full h-10 rounded-lg bg-accent text-accent-foreground font-medium text-sm disabled:opacity-40 hover:opacity-90 transition-opacity duration-200 flex items-center justify-center"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Get Started"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
