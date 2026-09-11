import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { AuthProvider } from "@/lib/auth/provider";
import { OnboardingGate } from "@/components/onboarding/onboarding";
import { SessionBoot } from "@/components/session-boot";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { SaveBootstrap } from "@/components/save-bootstrap";
import { TooltipProvider } from "@/components/ui/tooltip";
import appCss from "../styles.css?url";

const APP_NAME = "Hone";

export type SessionUser = { id: string; email: string | null };

export type RootContext = {
  sessionUser: SessionUser | null;
};

const fetchSessionUser = createServerFn({ method: "GET" }).handler(async () => {
  const { getSessionUser } = await import("@/lib/auth/verify.server");
  const u = await getSessionUser();
  return u ? { id: u.id, email: u.email } : null;
});

export const Route = createRootRouteWithContext<RootContext>()({
  beforeLoad: async () => {
    const hasDb = Boolean(process.env.DATABASE_URL?.trim());
    const prodBuild =
      import.meta.env.PROD || process.env.NODE_ENV === "production";
    // Built-output preview has no DATABASE_URL and no bundled PGLite
    // wasm, so skip the cookie session rather than crashing the process.
    if (prodBuild && !hasDb) {
      return { sessionUser: null };
    }
    try {
      return { sessionUser: await fetchSessionUser() };
    } catch {
      return { sessionUser: null };
    }
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      {
        name: "description",
        content:
          "Hone is a quant arithmetic trainer — timed drills, custom number ranges, and a memory of the facts that lag.",
      },
      { name: "theme-color", content: "#0a0b0d" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,500;1,9..144,600&family=IBM+Plex+Mono:wght@400;500&family=Outfit:wght@400;500;600&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <html lang="en" className="dark antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="bg-bg text-fg font-sans">
        <PreviewHostBridge />
        <AuthProvider>
          <TooltipProvider>
            <SessionBoot>
              <OnboardingGate>
                <SaveBootstrap />
                <Outlet />
              </OnboardingGate>
            </SessionBoot>
          </TooltipProvider>
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}
