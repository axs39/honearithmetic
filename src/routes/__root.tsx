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
import { DisplayNameGate } from "@/components/social/display-name-gate";
import { AppearanceBoot } from "@/components/appearance/appearance-boot";
import { TooltipProvider } from "@/components/ui/tooltip";
import appCss from "../styles.css?url";
import { UNSUPPORTED_BROWSER_GATE_SCRIPT } from "@/lib/browser/unsupported-gate-script";

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
        <script
          dangerouslySetInnerHTML={{
            __html: UNSUPPORTED_BROWSER_GATE_SCRIPT,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(window.__HONE_UNSUPPORTED__)return;var r=localStorage.getItem("hone.appearance.v1");var a=r?JSON.parse(r):{};var t=a.theme==="light"?"light":"dark";var f=a.font==="simple"?"simple":"default";var e=document.documentElement;e.classList.toggle("dark",t==="dark");e.classList.toggle("light",t==="light");e.dataset.theme=t;e.dataset.font=f;var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",t==="dark"?"#0a0b0d":"#f4f2ec");}catch(e){}})();`,
          }}
        />
      </head>
      <body className="bg-bg text-fg font-sans">
        <noscript>
          <div
            id="hone-unsupported"
            style={{
              boxSizing: "border-box",
              minHeight: "100vh",
              padding: "32px 20px",
              background: "#0a0b0d",
              color: "#f4f2ec",
              fontFamily:
                "-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif",
            }}
          >
            <div
              style={{
                maxWidth: 420,
                margin: "12vh auto 0",
                padding: "28px 24px",
                border: "1px solid #2a2d33",
                borderRadius: 16,
                background: "#121418",
              }}
            >
              <h1 style={{ fontSize: 28, margin: "0 0 12px" }}>
                Please enable JavaScript
              </h1>
              <p style={{ fontSize: 16, lineHeight: 1.5, color: "#c8c4bc" }}>
                Hone needs JavaScript (and a recent browser) to run. Turn JS on,
                or update Safari / Chrome, then open honearithmetic.trade again.
              </p>
            </div>
          </div>
        </noscript>
        <AppearanceBoot />
        <PreviewHostBridge />
        <AuthProvider>
          <TooltipProvider>
            <SessionBoot>
              <OnboardingGate>
                <SaveBootstrap />
                <DisplayNameGate />
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
