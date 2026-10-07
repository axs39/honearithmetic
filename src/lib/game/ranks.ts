import type { Session } from "./types";
import { isBoardEligibleSession } from "./types";

/** 120-second default clock — the benchmark round for ranks. */
export const BENCH_SECONDS = 120;

/** Ranks for a 120s default mix, lowest to highest. */
export const RANKS = [
  {
    min: 0,
    max: 20,
    label: "Bronze",
    detail: "Number facts are still settling in.",
  },
  {
    min: 20,
    max: 30,
    label: "Silver",
    detail: "Getting quicker on the basics.",
  },
  {
    min: 30,
    max: 40,
    label: "Gold",
    detail: "Solid, steady pace.",
  },
  {
    min: 40,
    max: 50,
    label: "Platinum",
    detail: "Fast and reliable across all four operations.",
  },
  {
    min: 50,
    max: 60,
    label: "Diamond",
    detail: "Very fast — few slip-ups.",
  },
  {
    min: 60,
    max: 200,
    label: "Master",
    detail: "Top rank. Rare pace.",
  },
] as const;

export type Rank = (typeof RANKS)[number];

/** Right edge of the Compare bar. */
export const SCALE_MAX = 80;

export function rankFor(score: number): Rank {
  return (
    RANKS.find((r) => score >= r.min && score < r.max) ??
    RANKS[RANKS.length - 1]!
  );
}

/** The next rank up and the points still needed to reach it; null at the top rank. */
export function nextRank(
  score: number,
): { rank: Rank; needed: number } | null {
  const next = RANKS.find((r) => r.min > score);
  if (!next) return null;
  return { rank: next, needed: Math.max(1, Math.ceil(next.min - score)) };
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

/**
 * Top score for Compare / ranks: official board rounds first
 * (Classic 120s, all ops, default ranges), else any completed 120s best.
 */
export function bestCompare120(
  sessions: Session[],
  bestByDuration: Record<string, number>,
): { score: number; source: "120s" | null } {
  let boardBest = 0;
  for (const s of sessions) {
    if (isBoardEligibleSession(s)) {
      boardBest = Math.max(boardBest, Number(s.score) || 0);
    }
  }
  if (boardBest > 0) return { score: boardBest, source: "120s" };

  let any120 = 0;
  for (const s of sessions) {
    if (s.completed && s.duration === 120) {
      any120 = Math.max(any120, Number(s.score) || 0);
    }
  }
  const map = Number(bestByDuration[String(BENCH_SECONDS)]) || 0;
  const best = Math.max(any120, map);
  if (best > 0) return { score: best, source: "120s" };
  return { score: 0, source: null };
}
