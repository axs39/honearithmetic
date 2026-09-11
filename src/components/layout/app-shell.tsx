import { Link, useRouterState } from "@tanstack/react-router";
import { BarChart3, Scale, Timer } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { SignedOut, UserButton } from "@/lib/auth/gates";
import { SignupHint } from "@/components/auth/signup-hint";
import { cn } from "@/lib/utils";
import { useGameStore } from "@/lib/game/store";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hydrate = useGameStore((s) => s.hydrate);
  const persist = useGameStore((s) => s.persist);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") persist();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", persist);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", persist);
    };
  }, [persist]);

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="flex items-center justify-between px-5 pt-5 pb-3 sm:px-8">
        <Link
          to="/"
          className="font-display text-xl italic tracking-tight text-fg"
        >
          Hone
        </Link>
        <div className="flex items-center gap-2">
          <nav className="hidden items-center gap-1 sm:flex">
            <NavLink to="/" active={pathname === "/"}>
              Drill
            </NavLink>
            <NavLink to="/progress" active={pathname === "/progress"}>
              Progress
            </NavLink>
            <NavLink to="/compare" active={pathname === "/compare"}>
              Compare
            </NavLink>
          </nav>
          <div className="[&_span]:text-muted [&_button]:text-muted [&_button]:hover:text-fg">
            <UserButton />
            <SignedOut>
              <div className="relative">
                <Link
                  to="/login"
                  className="px-3 py-2 text-sm text-muted hover:text-fg"
                >
                  Save progress
                </Link>
                <SignupHint />
              </div>
            </SignedOut>
          </div>
        </div>
      </header>
      <div className="px-5 pb-24 sm:px-8 sm:pb-16">{children}</div>
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-bg/95 px-2 pt-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] sm:hidden">
        <TabLink to="/" active={pathname === "/"} icon={<Timer className="size-5" />}>
          Drill
        </TabLink>
        <TabLink
          to="/progress"
          active={pathname === "/progress"}
          icon={<BarChart3 className="size-5" />}
        >
          Progress
        </TabLink>
        <TabLink
          to="/compare"
          active={pathname === "/compare"}
          icon={<Scale className="size-5" />}
        >
          Compare
        </TabLink>
      </nav>
    </div>
  );
}

function NavLink({
  to,
  active,
  children,
}: {
  to: "/" | "/progress" | "/compare";
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "rounded-sm px-3 py-2 text-sm transition-colors duration-150",
        active ? "text-fg" : "text-muted hover:text-fg",
      )}
    >
      {children}
    </Link>
  );
}

function TabLink({
  to,
  active,
  icon,
  children,
}: {
  to: "/" | "/progress" | "/compare";
  active: boolean;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-sm text-xs",
        active ? "text-fg" : "text-muted",
      )}
    >
      {icon}
      {children}
    </Link>
  );
}
