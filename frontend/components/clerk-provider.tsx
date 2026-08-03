"use client";

import { ClerkProvider } from "@clerk/react";

export function ClerkProviderClient({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!}>
      {children}
    </ClerkProvider>
  );
}
