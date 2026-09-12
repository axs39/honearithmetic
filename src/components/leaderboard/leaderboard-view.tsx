import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { StreakFireCount } from "@/components/leaderboard/streak-fire";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  getLeaderboard,
  getSocialStatus,
  type LeaderboardRow,
  type SocialStatus,
} from "@/lib/game/leaderboard";
import {
  clientTimeZone,
  pushLeaderboardScoresOnce,
} from "@/lib/game/sync-social";

type BoardTab = "allTime" | "weekly";

export function LeaderboardView() {
  const { user, isPending } = useCurrentUserState();
  const signedIn = Boolean(user && !user.isDevFallback);
  const [allTime, setAllTime] = useState<LeaderboardRow[] | null>(null);
  const [weekly, setWeekly] = useState<LeaderboardRow[] | null>(null);
  const [social, setSocial] = useState<SocialStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<BoardTab>("allTime");

  useEffect(() => {
    if (isPending) return;
    if (!signedIn) {
      setAllTime(null);
      setWeekly(null);
      setSocial(null);
      return;
    }
    let cancelled = false;
    pushLeaderboardScoresOnce();
    const tz = clientTimeZone();
    void Promise.all([
      getLeaderboard(),
      getSocialStatus({ data: { timeZone: tz } }),
    ])
      .then(([board, status]) => {
        if (cancelled) return;
        setAllTime(board.allTime);
        setWeekly(board.weekly);
        setSocial(status);
        setError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Could not load the leaderboard.");
      });
    return () => {
      cancelled = true;
    };
  }, [signedIn, isPending]);

  const rows = tab === "allTime" ? allTime : weekly;

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl pt-2">
        <h1 className="font-display text-3xl tracking-tight sm:text-4xl">
          Leaderboard
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
          Ranked by best completed 120-second score. Streaks use your local
          calendar day — finish a full 2-minute round to keep the fire lit. Miss
          a day and you get two full days after that missed day ends to rescue
          your streak.
        </p>

        {isPending ? (
          <p className="mt-8 text-sm text-muted">Loading…</p>
        ) : !signedIn ? (
          <section className="mt-8 rounded-xl bg-surface p-6 shadow-[var(--shadow-border)]">
            <p className="text-sm leading-relaxed text-muted">
              Sign in to access leaderboard + streak
            </p>
            <Button asChild className="mt-4" size="lg">
              <Link to="/login">Sign in</Link>
            </Button>
          </section>
        ) : (
          <>
            {social?.hideFromLeaderboard ? (
              <p className="mt-4 rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">
                You’re hidden from the leaderboard. Others still appear below —
                change this in Settings → Privacy.
              </p>
            ) : null}

            {social ? (
              <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Stat
                  label="Your streak"
                  value={
                    social.streakCount > 0 ? (
                      <StreakFireCount count={social.streakCount} size={20} />
                    ) : (
                      "—"
                    )
                  }
                />
                <Stat
                  label="Best default 120s"
                  value={social.best120 > 0 ? String(social.best120) : "—"}
                />
                <Stat
                  label="Rescue"
                  value={
                    social.streakRescueAvailable ? "Available" : "—"
                  }
                />
              </div>
            ) : null}

            {social?.streakRescueAvailable ? (
              <p className="mt-3 text-sm text-terra">
                Streak rescue: finish a 120s round scoring at least{" "}
                {Math.max(0, social.best120 - 7)} before your rescue window
                ends
                {social.streakRescueDeadline
                  ? ` (${new Date(social.streakRescueDeadline).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })})`
                  : ""}
                .
              </p>
            ) : null}

            <section className="mt-6 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xs font-medium tracking-wide text-muted uppercase">
                  Top scores
                </h2>
                <div
                  role="tablist"
                  aria-label="Leaderboard period"
                  className="inline-flex rounded-lg bg-surface-2 p-0.5 shadow-[var(--shadow-border)]"
                >
                  <BoardTabButton
                    active={tab === "allTime"}
                    onClick={() => setTab("allTime")}
                  >
                    All-time
                  </BoardTabButton>
                  <BoardTabButton
                    active={tab === "weekly"}
                    onClick={() => setTab("weekly")}
                  >
                    Weekly
                  </BoardTabButton>
                </div>
              </div>

              {tab === "weekly" ? (
                <p className="mt-3 text-xs leading-relaxed text-muted">
                  Best completed 120s this week. Weekly resets Monday midnight
                  PT.
                </p>
              ) : (
                <p className="mt-3 text-xs leading-relaxed text-muted">
                  Best completed 120s ever — never resets.
                </p>
              )}

              {error ? (
                <p className="mt-3 text-sm text-terra">{error}</p>
              ) : rows == null ? (
                <p className="mt-3 text-sm text-muted">Loading…</p>
              ) : (
                <ul className="mt-3 divide-y divide-border">
                  {Array.from({ length: 10 }, (_, i) => {
                    const row = rows[i];
                    if (!row) {
                      return (
                        <li
                          key={`empty-${tab}-${i + 1}`}
                          className="flex items-baseline justify-between gap-3 py-2.5 text-sm"
                        >
                          <span className="flex min-w-0 items-baseline gap-3">
                            <span className="font-mono w-6 shrink-0 tabular-nums text-subtle">
                              {i + 1}
                            </span>
                            <span className="text-subtle">—</span>
                          </span>
                          <span className="font-mono shrink-0 tabular-nums text-subtle">
                            —
                          </span>
                        </li>
                      );
                    }
                    const isYou =
                      social?.displayName != null &&
                      row.displayName === social.displayName;
                    return (
                      <li
                        key={`${tab}-${row.userId}`}
                        className="flex items-baseline justify-between gap-3 py-2.5 text-sm"
                      >
                        <span className="flex min-w-0 items-baseline gap-3">
                          <span className="font-mono w-6 shrink-0 tabular-nums text-subtle">
                            {row.rank}
                          </span>
                          <span
                            className={
                              isYou
                                ? "truncate font-medium text-fg"
                                : "truncate text-fg"
                            }
                          >
                            {row.displayName}
                            {isYou ? " · you" : ""}
                          </span>
                          {row.streakCount > 0 ? (
                            <StreakFireCount count={row.streakCount} size={14} />
                          ) : null}
                        </span>
                        <span className="font-mono shrink-0 tabular-nums text-muted">
                          {row.best120}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

function BoardTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        active
          ? "rounded-md bg-surface px-3 py-1.5 text-xs font-medium text-fg shadow-sm"
          : "rounded-md px-3 py-1.5 text-xs font-medium text-muted hover:text-fg"
      }
    >
      {children}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg bg-surface px-3 py-3 shadow-[var(--shadow-border)]">
      <p className="text-[11px] tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-1 font-mono text-xl tabular-nums text-fg">{value}</p>
    </div>
  );
}
