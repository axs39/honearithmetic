import type { Session } from "./types";

/** 120-second default clock — the desk benchmark. */
export const BENCH_SECONDS = 120;

/** Community / interview-prep bands for a 120s default mix. */
export const QUANT_BANDS = [
  {
    min: 0,
    max: 20,
    label: "Foundation",
    detail: "Number facts are not yet automatic.",
  },
  {
    min: 20,
    max: 30,
    label: "Building",
    detail: "Typical of someone just starting interview prep.",
  },
  {
    min: 30,
    max: 40,
    label: "Interview range",
    detail: "Approaching what most desks screen for.",
  },
  {
    min: 40,
    max: 50,
    label: "Desk-ready",
    detail: "Around a passing candidate and a working trader.",
  },
  {
    min: 50,
    max: 60,
    label: "Strong",
    detail: "Comfortable on almost every arithmetic screen.",
  },
  {
    min: 60,
    max: 200,
    label: "Elite",
    detail: "Optiver-level pace. Rare on a trading floor.",
  },
] as const;

/** Fair average for a working quant trader on the 120s default mix. */
export const AVG_TRADER_SCORE = 44;
export const AVG_CANDIDATE_SCORE = 32;
export const ELITE_SCORE = 60;
export const SCALE_MAX = 80;

export function bandFor(score: number) {
  return (
    QUANT_BANDS.find((b) => score >= b.min && score < b.max) ??
    QUANT_BANDS[QUANT_BANDS.length - 1]!
  );
}

/** Convert any completed session to a 120s-equivalent score via pace. */
export function equivalent120(session: Session): number {
  if (session.duration <= 0) return 0;
  return session.ppm * 2;
}

export function bestEquivalent120(
  sessions: Session[],
  bestByDuration: Record<string, number>,
): { score: number; source: "120s" | "equivalent" | null } {
  const direct = bestByDuration[String(BENCH_SECONDS)];
  if (direct != null && direct > 0) {
    return { score: direct, source: "120s" };
  }
  const completed = sessions.filter((s) => s.completed && s.score > 0);
  if (completed.length === 0) return { score: 0, source: null };
  const best = Math.max(...completed.map(equivalent120));
  return { score: best, source: "equivalent" };
}

export function traderDelta(score: number): number {
  return Math.round(score - AVG_TRADER_SCORE);
}
