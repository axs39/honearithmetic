import type { FactMap, FactStat, GameSettings, Op, Problem } from "./types";
import { enabledOps } from "./types";
import { parseFactKey, rankWeakFacts, weightForProblem } from "./adaptive";

function randInt(min: number, max: number): number {
  const lo = Math.ceil(Math.min(min, max));
  const hi = Math.floor(Math.max(min, max));
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function factKeyFor(op: Op, a: number, b: number): string {
  if (op === "add" || op === "mul") {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    return `${op}:${lo}:${hi}`;
  }
  return `${op}:${a}:${b}`;
}

function inRange(n: number, min: number, max: number): boolean {
  return n >= Math.min(min, max) && n <= Math.max(min, max);
}

function placePair(
  x: number,
  y: number,
  leftMin: number,
  leftMax: number,
  rightMin: number,
  rightMax: number,
): [number, number] | null {
  const aLeft = inRange(x, leftMin, leftMax) && inRange(y, rightMin, rightMax);
  const bLeft = inRange(y, leftMin, leftMax) && inRange(x, rightMin, rightMax);
  if (aLeft && bLeft) return Math.random() < 0.5 ? [x, y] : [y, x];
  if (aLeft) return [x, y];
  if (bLeft) return [y, x];
  return null;
}

/** Interleave ops: no immediate repeat when possible; prefer underused ops. */
function pickOpDiverse(ops: Op[], recentOps: Op[]): Op {
  if (ops.length === 1) return ops[0]!;
  const last = recentOps[recentOps.length - 1];
  const counts = new Map<Op, number>();
  for (const op of ops) counts.set(op, 0);
  for (const op of recentOps) {
    if (counts.has(op)) counts.set(op, (counts.get(op) ?? 0) + 1);
  }
  const minCount = Math.min(...ops.map((op) => counts.get(op) ?? 0));
  const weights = ops.map((op) => {
    // Hard ban: never continue the same op when alternatives exist.
    if (op === last) return 0;
    const count = counts.get(op) ?? 0;
    // Strongly favor ops that are behind in this session.
    const deficit = count - minCount;
    if (deficit === 0) return 3.5;
    if (deficit === 1) return 1.0;
    return 0.25 / deficit;
  });
  const total = weights.reduce((s, w) => s + w, 0);
  if (total <= 0) {
    const others = ops.filter((op) => op !== last);
    return others.length ? pick(others) : ops[0]!;
  }
  let r = Math.random() * total;
  for (let i = 0; i < ops.length; i += 1) {
    r -= weights[i]!;
    if (r <= 0) return ops[i]!;
  }
  return ops[ops.length - 1]!;
}

function recentOpsFromKeys(recentKeys: string[]): Op[] {
  const out: Op[] = [];
  for (const key of recentKeys) {
    const parsed = parseFactKey(key);
    if (parsed) out.push(parsed.op);
  }
  return out;
}

export function randomProblem(
  settings: GameSettings,
  op?: Op,
  recentOps: Op[] = [],
): Problem | null {
  const ops = op ? [op] : enabledOps(settings);
  if (ops.length === 0) return null;
  const chosen = op ? op : pickOpDiverse(ops, recentOps);

  for (let attempt = 0; attempt < 24; attempt++) {
    if (chosen === "add") {
      const a = randInt(settings.addLeft.min, settings.addLeft.max);
      const b = randInt(settings.addRight.min, settings.addRight.max);
      return { op: "add", a, b, answer: a + b, key: factKeyFor("add", a, b) };
    }
    if (chosen === "sub") {
      const x = randInt(settings.addLeft.min, settings.addLeft.max);
      const y = randInt(settings.addRight.min, settings.addRight.max);
      const minuend = x + y;
      return {
        op: "sub",
        a: minuend,
        b: x,
        answer: y,
        key: factKeyFor("sub", minuend, x),
      };
    }
    if (chosen === "mul") {
      const a = randInt(settings.mulLeft.min, settings.mulLeft.max);
      const b = randInt(settings.mulRight.min, settings.mulRight.max);
      return { op: "mul", a, b, answer: a * b, key: factKeyFor("mul", a, b) };
    }
    const divisor = randInt(settings.mulLeft.min, settings.mulLeft.max);
    const quotient = randInt(settings.mulRight.min, settings.mulRight.max);
    if (divisor === 0) continue;
    const dividend = divisor * quotient;
    return {
      op: "div",
      a: dividend,
      b: divisor,
      answer: quotient,
      key: factKeyFor("div", dividend, divisor),
    };
  }
  return null;
}

export function problemFromFact(
  fact: FactStat,
  settings: GameSettings,
): Problem | null {
  const parsed = parseFactKey(fact.key);
  if (!parsed) return null;
  const { op, a, b } = parsed;
  if (!settings[op]) return null;

  if (op === "add") {
    const placed = placePair(
      a,
      b,
      settings.addLeft.min,
      settings.addLeft.max,
      settings.addRight.min,
      settings.addRight.max,
    );
    if (!placed) return null;
    return {
      op,
      a: placed[0],
      b: placed[1],
      answer: placed[0] + placed[1],
      key: fact.key,
    };
  }
  if (op === "sub") {
    if (a - b < 0) return null;
    return { op, a, b, answer: a - b, key: fact.key };
  }
  if (op === "mul") {
    const placed = placePair(
      a,
      b,
      settings.mulLeft.min,
      settings.mulLeft.max,
      settings.mulRight.min,
      settings.mulRight.max,
    );
    if (!placed) return null;
    return {
      op,
      a: placed[0],
      b: placed[1],
      answer: placed[0] * placed[1],
      key: fact.key,
    };
  }
  if (b === 0 || a % b !== 0) return null;
  return { op, a, b, answer: a / b, key: fact.key };
}

function neighborProblem(fact: FactStat, settings: GameSettings): Problem | null {
  const parsed = parseFactKey(fact.key);
  if (!parsed) return null;
  const jitter = () => {
    const d = pick([-2, -1, 1, 2]);
    return d;
  };
  if (parsed.op === "mul") {
    const a = Math.max(2, parsed.a + jitter());
    const b = Math.max(2, parsed.b + jitter());
    const placed = placePair(
      a,
      b,
      settings.mulLeft.min,
      settings.mulLeft.max,
      settings.mulRight.min,
      settings.mulRight.max,
    );
    if (!placed) return randomProblem(settings, "mul");
    return {
      op: "mul",
      a: placed[0],
      b: placed[1],
      answer: placed[0] * placed[1],
      key: factKeyFor("mul", placed[0], placed[1]),
    };
  }
  return randomProblem(settings, parsed.op);
}

function weightedPick(problems: Problem[], weights: number[]): Problem {
  const total = weights.reduce((s, w) => s + w, 0);
  if (total <= 0) return pick(problems);
  let r = Math.random() * total;
  for (let i = 0; i < problems.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return problems[i]!;
  }
  return problems[problems.length - 1]!;
}

export function nextProblem(
  settings: GameSettings,
  facts: FactMap,
  recentKeys: string[],
  lastKey?: string,
): Problem {
  const ops = enabledOps(settings);
  const recentOps = recentOpsFromKeys(recentKeys);
  const seen = new Set(recentKeys);
  if (lastKey) seen.add(lastKey);
  // Soft adaptive window stays short; session-seen list can be long.
  const softRecent = recentKeys.slice(-8);
  const fallback: Problem = {
    op: "add",
    a: 2,
    b: 2,
    answer: 4,
    key: "add:2:2",
  };
  if (ops.length === 0) return fallback;

  const isFresh = (p: Problem | null | undefined): p is Problem =>
    Boolean(p && !seen.has(p.key));

  const mode = settings.mode;
  const makeRandom = () => {
    for (let i = 0; i < 48; i++) {
      const p = randomProblem(settings, undefined, recentOps);
      if (isFresh(p)) return p;
    }
    // Exhausted unique facts for this range — avoid immediate repeat only.
    for (let i = 0; i < 12; i++) {
      const p = randomProblem(settings, undefined, recentOps);
      if (p && p.key !== lastKey) return p;
    }
    return randomProblem(settings, undefined, recentOps) ?? fallback;
  };

  const seedPerOp = (into: Problem[]) => {
    // Guarantee each enabled op shows up in the pool so weighting can't
    // collapse into a same-op segment.
    for (const op of ops) {
      for (let i = 0; i < 8; i++) {
        const p = randomProblem(settings, op, recentOps);
        if (isFresh(p)) {
          into.push(p);
          break;
        }
      }
    }
  };

  const withDiversity = (p: Problem, base: number): number => {
    const last = recentOps[recentOps.length - 1];
    let mult = 1;
    // Hard-zero same-op streak when alternatives exist in the candidate pool later;
    // here heavily penalize so weighted pick almost never continues an op.
    if (p.op === last) mult *= 0.02;
    else mult *= 1.4;
    if (seen.has(p.key)) mult *= 0.01;
    const counts = recentOps.filter((o) => o === p.op).length;
    const minCount = Math.min(
      ...ops.map((op) => recentOps.filter((o) => o === op).length),
    );
    if (counts > minCount) mult *= 0.35;
    return Math.max(0.001, base * mult);
  };

  if (mode === "classic") return makeRandom();

  const weak = rankWeakFacts(facts, settings).slice(0, mode === "focus" ? 12 : 20);
  const usableWeak = weak.filter((f) => problemFromFact(f, settings));

  if (mode === "focus" && usableWeak.length >= 4) {
    const candidates: Problem[] = [];
    seedPerOp(candidates);
    for (const f of usableWeak) {
      const p = problemFromFact(f, settings);
      if (isFresh(p)) candidates.push(p);
      const n = neighborProblem(f, settings);
      if (isFresh(n)) candidates.push(n);
    }
    for (let i = 0; i < 6; i++) {
      const p = makeRandom();
      if (isFresh(p)) candidates.push(p);
    }
    if (candidates.length === 0) return makeRandom();
    const weights = candidates.map((p) =>
      withDiversity(p, weightForProblem(p, facts, softRecent, "focus")),
    );
    return weightedPick(candidates, weights);
  }

  const candidates: Problem[] = [];
  seedPerOp(candidates);
  for (let i = 0; i < 24; i++) {
    const p = randomProblem(settings, undefined, recentOps);
    if (isFresh(p)) candidates.push(p);
  }
  for (const f of usableWeak) {
    const p = problemFromFact(f, settings);
    if (isFresh(p)) candidates.push(p);
  }
  if (usableWeak[0]) {
    const n = neighborProblem(usableWeak[0], settings);
    if (isFresh(n)) candidates.push(n);
  }
  if (candidates.length === 0) return makeRandom();
  const weights = candidates.map((p) =>
    withDiversity(p, weightForProblem(p, facts, softRecent, "adaptive")),
  );
  return weightedPick(candidates, weights);
}
