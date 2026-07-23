import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function SSOCallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
      <AuthenticateWithRedirectCallback signUpFallbackRedirectUrl="/onboarding" signInFallbackRedirectUrl="/onboarding" />
    </div>
  );
}
