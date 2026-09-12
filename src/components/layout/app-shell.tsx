import { Link, useRouterState } from "@tanstack/react-router";
import { BarChart3, Scale, Settings, Timer, Trophy } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { SignedOut, UserButton } from "@/lib/auth/gates";
import { SignupHint } from "@/components/auth/signup-hint";
import { cn } from "@/lib/utils";
import { useGameStore } from "@/lib/game/store";

type AppPath = "/" | "/progress" | "/compare" | "/leaderboard" | "/settings";

function pageMotionClass(pathname: string): string {
  if (pathname.startsWith("/progress")) return "page-motion page-motion--rise";
  if (pathname.startsWith("/leaderboard")) return "page-motion page-motion--cascade";
  if (pathname.startsWith("/compare")) return "page-motion page-motion--split";
  if (pathname.startsWith("/settings")) return "page-motion page-motion--soft";
  // Drill hub — same roll-out family as Hello Arnav
  return "page-motion page-motion--reveal";
}

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
            <NavLink to="/leaderboard" active={pathname === "/leaderboard"}>
              Leaderboard
            </NavLink>
            <NavLink to="/settings" active={pathname === "/settings"}>
              Settings
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
      <div
        key={pathname}
        className={cn(
          "px-5 pb-24 sm:px-8 sm:pb-16",
          pageMotionClass(pathname),
        )}
      >
        {children}
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-bg/95 px-1 pt-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] sm:hidden">
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
        <TabLink
          to="/leaderboard"
          active={pathname === "/leaderboard"}
          icon={<Trophy className="size-5" />}
        >
          Board
        </TabLink>
        <TabLink
          to="/settings"
          active={pathname === "/settings"}
          icon={<Settings className="size-5" />}
        >
          Settings
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
  to: AppPath;
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
  to: AppPath;
  active: boolean;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-sm text-[10px]",
        active ? "text-fg" : "text-muted",
      )}
    >
      {icon}
      {children}
    </Link>
  );
}
