import { useGameStore } from "./store";

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
  const fromMap = Number(s.bestByDuration?.["120"]) || 0;
  let fromSessions = 0;
  for (const sess of s.sessions ?? []) {
    if (sess.duration === 120 && sess.completed) {
      fromSessions = Math.max(fromSessions, Number(sess.score) || 0);
    }
  }
  return Math.max(0, Math.floor(fromMap), Math.floor(fromSessions));
}

let best120Synced = false;

/**
 * Push local best-120 to the server once per page session (when signed in).
 * Safe to call from hydrate / boot / leaderboard / settings — no-ops after success.
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
