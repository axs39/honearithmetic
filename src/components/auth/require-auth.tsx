import { useRouteContext } from "@tanstack/react-router";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import type { ReactNode } from "react";

export function AppSplash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg text-fg">
      <p className="font-display text-3xl italic tracking-tight">Hone</p>
      <p className="mt-3 text-sm text-muted">Loading…</p>
    </div>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  const { sessionUser } = useRouteContext({ from: "__root__" });
  if (user) return <>{children}</>;
  if (isPending && sessionUser) return <>{children}</>;
  if (isPending) return <AppSplash />;
  return <RedirectToSignIn />;
}
