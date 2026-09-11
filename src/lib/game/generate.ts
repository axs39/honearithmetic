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

export function randomProblem(settings: GameSettings, op?: Op): Problem | null {
  const ops = op ? [op] : enabledOps(settings);
  if (ops.length === 0) return null;
  const chosen = pick(ops);

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
  const fallback: Problem = {
    op: "add",
    a: 2,
    b: 2,
    answer: 4,
    key: "add:2:2",
  };
  if (ops.length === 0) return fallback;

  const mode = settings.mode;
  const makeRandom = () => {
    for (let i = 0; i < 12; i++) {
      const p = randomProblem(settings);
      if (p && p.key !== lastKey) return p;
    }
    return randomProblem(settings) ?? fallback;
  };

  if (mode === "classic") return makeRandom();

  const weak = rankWeakFacts(facts, settings).slice(0, mode === "focus" ? 12 : 20);
  const usableWeak = weak.filter((f) => problemFromFact(f, settings));

  if (mode === "focus" && usableWeak.length >= 4) {
    const candidates: Problem[] = [];
    for (const f of usableWeak) {
      const p = problemFromFact(f, settings);
      if (p && p.key !== lastKey) candidates.push(p);
      const n = neighborProblem(f, settings);
      if (n && n.key !== lastKey) candidates.push(n);
    }
    for (let i = 0; i < 6; i++) {
      const p = makeRandom();
      if (p.key !== lastKey) candidates.push(p);
    }
    if (candidates.length === 0) return makeRandom();
    const weights = candidates.map((p) =>
      weightForProblem(p, facts, recentKeys, "focus"),
    );
    return weightedPick(candidates, weights);
  }

  const candidates: Problem[] = [];
  for (let i = 0; i < 16; i++) {
    const p = randomProblem(settings);
    if (p && p.key !== lastKey) candidates.push(p);
  }
  for (const f of usableWeak) {
    const p = problemFromFact(f, settings);
    if (p && p.key !== lastKey) candidates.push(p);
  }
  if (usableWeak[0]) {
    const n = neighborProblem(usableWeak[0], settings);
    if (n && n.key !== lastKey) candidates.push(n);
  }
  if (candidates.length === 0) return makeRandom();
  const weights = candidates.map((p) =>
    weightForProblem(p, facts, recentKeys, "adaptive"),
  );
  return weightedPick(candidates, weights);
}
