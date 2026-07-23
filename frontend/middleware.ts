import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublic = createRouteMatcher(["/", "/login(.*)", "/register(.*)", "/sso-callback(.*)", "/onboarding(.*)"]);
const isAuthRoute = createRouteMatcher(["/login(.*)", "/register(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  if (userId && isAuthRoute(req)) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (!isPublic(req)) await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ico|ttf|woff2?)).*)",
    "/(api|trpc)(.*)",
  ],
};
