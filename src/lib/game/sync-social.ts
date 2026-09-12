import { useGameStore } from "./store";
import { isInCurrentWeekPT } from "./pt-day";
import { isBoardEligibleSession } from "./types";

/** Browser IANA timezone, or Pacific fallback. */
export function clientTimeZone(): string {
  try {
    return (
      Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles"
    );
  } catch {
    return "America/Los_Angeles";
  }
}

/** Local best completed 120s score from store map + sessions. */
export function localBest120(): number {
  const s = useGameStore.getState();
  let fromSessions = 0;
  for (const sess of s.sessions ?? []) {
    if (isBoardEligibleSession(sess)) {
      fromSessions = Math.max(fromSessions, Number(sess.score) || 0);
    }
  }
  return Math.max(0, Math.floor(fromSessions));
}

/** Best completed 120s from local sessions in the current PT week only. */
export function localBest120Week(): number {
  const s = useGameStore.getState();
  let best = 0;
  for (const sess of s.sessions ?? []) {
    if (
      isBoardEligibleSession(sess) &&
      isInCurrentWeekPT(Number(sess.at) || 0)
    ) {
      best = Math.max(best, Number(sess.score) || 0);
    }
  }
  return Math.max(0, Math.floor(best));
}

let best120Synced = false;
let best120WeekSynced = false;

/**
 * Push local best-120 to the server once per page session (when signed in).
 * Safe to call from hydrate / boot / leaderboard / settings — no-ops after success.
 * All-time only — does not touch the weekly board.
 */
export function pushBest120Once(): void {
  if (best120Synced) return;
  if (typeof window === "undefined") return;
  const best120 = localBest120();
  if (best120 <= 0) return;
  best120Synced = true;
  const timeZone = clientTimeZone();
  void import("./leaderboard")
    .then(({ syncBest120 }) =>
      syncBest120({ data: { best120, timeZone } }),
    )
    .catch(() => {
      best120Synced = false;
    });
}

/**
 * Push this-PT-week best completed 120s from local sessions (once per page session).
 * Never copies historical all-time into weekly.
 */
export function pushBest120WeekOnce(): void {
  if (best120WeekSynced) return;
  if (typeof window === "undefined") return;
  const best120Week = localBest120Week();
  if (best120Week <= 0) return;
  best120WeekSynced = true;
  const timeZone = clientTimeZone();
  void import("./leaderboard")
    .then(({ syncBest120Week }) =>
      syncBest120Week({ data: { best120Week, timeZone } }),
    )
    .catch(() => {
      best120WeekSynced = false;
    });
}

/** Convenience: all-time + weekly backfill when opening leaderboard / hydrate. */
export function pushLeaderboardScoresOnce(): void {
  pushBest120Once();
  pushBest120WeekOnce();
}
