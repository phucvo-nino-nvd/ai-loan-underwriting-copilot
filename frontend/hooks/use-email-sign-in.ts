"use client";

import { useAuth, useClerk, useSignIn } from "@clerk/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

function clerkMessage(err: unknown): string {
  const first = (err as any)?.errors?.[0];
  return first?.longMessage || first?.message || "";
}

/**
 * The sign-in flow behind both surfaces that offer one: the landing page card and /login. It lives
 * here because it was written twice and drifted — a fix to one left the other broken.
 *
 * A correct password is not always the end of it. Client Trust makes every unrecognised device (an
 * incognito window is always one) verify an email code before the session is created, and a 2FA
 * account asks for its second factor the same way. Both surface as `needsCode`.
 */
export function useEmailSignIn() {
  const clerk = useClerk();
  const { signIn } = useSignIn();
  const { isSignedIn } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [needsCode, setNeedsCode] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const finalize = () =>
    signIn.finalize({
      navigate: ({ decorateUrl }) => {
        const url = decorateUrl("/dashboard");
        if (url.startsWith("http")) {
          window.location.href = url;
        } else {
          router.push(url);
        }
      },
    });

  async function signInWithOAuth(strategy: "oauth_google" | "oauth_github") {
    if (!clerk.loaded) return;
    if (isSignedIn) {
      router.push("/dashboard");
      return;
    }
    try {
      await clerk.client.signIn.authenticateWithRedirect({
        strategy,
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/dashboard",
      });
    } catch (err) {
      setError(clerkMessage(err) || "Something went wrong.");
    }
  }

  async function submitPassword() {
    if (!clerk.loaded) return;
    setLoading(true);
    setError("");

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Please enter your email address.");
      setLoading(false);
      return;
    }

    const { error: signInError } = await signIn.password({ emailAddress: trimmedEmail, password });
    if (signInError) {
      const code = (signInError as any).errors?.[0]?.code;
      if (code === "form_identifier_not_found") {
        setError("No account found with this email. Please sign up first.");
      } else if (code === "form_password_incorrect" || code === "form_password_pwned") {
        setError("Incorrect password. Please try again.");
      } else {
        setError(clerkMessage(signInError) || "Invalid email or password.");
      }
      setLoading(false);
      return;
    }

    if (signIn.status === "complete") {
      await finalize();
    } else if (signIn.status === "needs_client_trust" || signIn.status === "needs_second_factor") {
      const { error: sendError } = await signIn.mfa.sendEmailCode();
      if (sendError) {
        const factors = signIn.supportedSecondFactors.map((f) => f.strategy).join(", ");
        setError(clerkMessage(sendError) || `This account needs a second factor: ${factors}.`);
      } else {
        setNeedsCode(true);
      }
    } else {
      const factors = signIn.supportedFirstFactors.map((f) => f.strategy).join(", ");
      setError(
        factors
          ? `This account signs in with: ${factors}. Password is not one of them.`
          : `Sign in stopped at "${signIn.status}".`
      );
    }

    setLoading(false);
  }

  async function submitCode() {
    if (!clerk.loaded) return;
    setLoading(true);
    setError("");

    const { error: verifyError } = await signIn.mfa.verifyEmailCode({ code: code.trim() });
    if (verifyError) {
      setError(clerkMessage(verifyError) || "Invalid verification code.");
    } else if (signIn.status === "complete") {
      await finalize();
    } else {
      setError(`Sign in stopped at "${signIn.status}".`);
    }

    setLoading(false);
  }

  function backToPassword() {
    setNeedsCode(false);
    setCode("");
    setError("");
  }

  return {
    ready: clerk.loaded,
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
  };
}
