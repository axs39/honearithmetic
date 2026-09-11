import type {
  FactMap,
  FactStat,
  GameSettings,
  Op,
  Problem,
  SessionEvent,
} from "./types";
import { enabledOps } from "./types";

export type ParsedKey = { op: Op; a: number; b: number };

export function parseFactKey(key: string): ParsedKey | null {
  const [op, as, bs] = key.split(":");
  if (op !== "add" && op !== "sub" && op !== "mul" && op !== "div") return null;
  const a = Number(as);
  const b = Number(bs);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return { op, a, b };
}

export function expectedMs(op: Op, a: number, b: number): number {
  if (op === "mul") {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    if (hi <= 12) {
      const hard = new Set([6, 7, 8, 9, 12]);
      const extra = (hard.has(lo) ? 220 : 0) + (hard.has(hi) ? 220 : 0);
      return 700 + extra + lo * 12 + hi * 8;
    }
    return 1500 + hi * 6 + lo * 25;
  }
  if (op === "div") {
    const quotient = b === 0 ? a : a / b;
    return expectedMs("mul", b, quotient) + 260;
  }
  if (op === "add") {
    return 620 + Math.max(a, b) * 2 + (a + b > 100 ? 150 : 0);
  }
  return 780 + a * 2.2;
}

export function expectedMsForKey(key: string): number {
  const p = parseFactKey(key);
  if (!p) return 1200;
  return expectedMs(p.op, p.a, p.b);
}

export function slowness(fact: FactStat): number {
  const exp = expectedMsForKey(fact.key);
  return fact.emaMs / Math.max(200, exp);
}

export function factScore(fact: FactStat): number {
  const err = fact.errors / Math.max(1, fact.attempts);
  return slowness(fact) * (1 + 2 * err);
}

export function rankWeakFacts(
  facts: FactMap,
  settings?: GameSettings,
  minAttempts = 2,
): FactStat[] {
  const ops = settings ? new Set(enabledOps(settings)) : null;
  return Object.values(facts)
    .filter((f) => f.attempts >= minAttempts)
    .filter((f) => (ops ? ops.has(f.op) : true))
    .sort((a, b) => factScore(b) - factScore(a));
}

export function weightForProblem(
  problem: Problem,
  facts: FactMap,
  recentKeys: string[],
  mode: "adaptive" | "focus",
): number {
  const fact = facts[problem.key];
  const recent = recentKeys.includes(problem.key) ? 0.18 : 1;
  if (!fact || fact.attempts === 0) {
    return (mode === "focus" ? 0.4 : 1.15) * recent;
  }
  const sampleBoost = fact.attempts < 4 ? 1.35 : 1;
  const focusBoost = mode === "focus" ? 1.4 : 1;
  return Math.max(0.06, factScore(fact) * sampleBoost * focusBoost * recent);
}

const EMA_ALPHA = 0.32;

export function applyAttempt(
  facts: FactMap,
  event: { key: string; op: Op; a: number; b: number; ms: number; errors: number },
  now: number,
): FactMap {
  const prev = facts[event.key];
  const attempts = (prev?.attempts ?? 0) + 1;
  const correct = (prev?.correct ?? 0) + 1;
  const errors = (prev?.errors ?? 0) + event.errors;
  const emaMs = prev
    ? prev.emaMs * (1 - EMA_ALPHA) + event.ms * EMA_ALPHA
    : event.ms;
  const next: FactStat = {
    key: event.key,
    op: event.op,
    a: event.a,
    b: event.b,
    attempts,
    correct,
    errors,
    emaMs,
    lastMs: event.ms,
    lastSeen: now,
  };
  return { ...facts, [event.key]: next };
}

export function mulCoverage(facts: FactMap): { seen: number; total: number } {
  let seen = 0;
  for (let a = 2; a <= 12; a++) {
    for (let b = a; b <= 12; b++) {
      const key = `mul:${a}:${b}`;
      if (facts[key] && facts[key]!.attempts > 0) seen += 1;
    }
  }
  return { seen, total: 66 };
}

export function recommend(facts: FactMap, sessions: number): {
  mode: "classic" | "adaptive" | "focus";
  duration: number;
  label: string;
  detail: string;
  cluster?: string;
} {
  if (sessions === 0) {
    return {
      mode: "classic",
      duration: 120,
      label: "Classic 120s",
      detail: "Uniform mix on the 120s clock. We’ll start mapping your speed.",
    };
  }
  const weak = rankWeakFacts(facts).slice(0, 12);
  if (weak.length >= 6) {
    const mulWeak = weak.filter((f) => f.op === "mul" || f.op === "div");
    const counts = new Map<number, number>();
    for (const f of mulWeak) {
      const n = f.op === "mul" ? Math.min(f.a, f.b) : f.b;
      if (n >= 2 && n <= 12) counts.set(n, (counts.get(n) ?? 0) + 1);
    }
    let bestN = 0;
    let bestC = 0;
    for (const [n, c] of counts) {
      if (c > bestC) {
        bestN = n;
        bestC = c;
      }
    }
    if (bestC >= 3) {
      return {
        mode: "focus",
        duration: 60,
        label: `Focus on ${bestN}×`,
        detail: `Your ${bestN}s are the slow cluster. A short drill will close the gap.`,
        cluster: `${bestN}×`,
      };
    }
    return {
      mode: "focus",
      duration: 60,
      label: "Focus on weak facts",
      detail: "We’ll spend most of this round on the problems that cost you time.",
    };
  }
  return {
    mode: "adaptive",
    duration: 120,
    label: "Adaptive 120s",
    detail: "Weighted toward the facts you’re slowest on, with enough mix to keep you honest.",
  };
}

export function improvementsFrom(
  events: SessionEvent[],
): SessionEvent[] {
  return events
    .filter(
      (e) => e.prevEma != null && e.ms < e.prevEma * 0.85 && e.prevEma > 700,
    )
    .sort((a, b) => (a.ms / (a.prevEma ?? 1)) - (b.ms / (b.prevEma ?? 1)))
    .slice(0, 5);
}
