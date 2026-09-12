import { expectedMs, parseFactKey, slowness } from "./adaptive";
import type { FactMap, FactStat, Op, Session } from "./types";
import { OP_LABEL, OP_SYMBOL } from "./types";

export type OpBand = {
  id: string;
  label: string;
  /** 0–100 fluency; null = no attempts in this band yet */
  fluency: number | null;
  attempts: number;
  seen: number;
  total: number;
  avgMs: number | null;
};

export type OpPerformance = {
  op: Op;
  symbol: string;
  label: string;
  /** Overall fluency across attempted facts (0–100) */
  fluencyPct: number | null;
  accuracyPct: number | null;
  coveragePct: number;
  attempts: number;
  bands: OpBand[];
  /** Recent session fluency for this op (line over time) */
  history: { i: number; label: string; fluency: number; n: number }[];
};

function fluencyFromFact(f: FactStat): number {
  if (f.attempts <= 0) return 0;
  const ratio = slowness(f); // ema / expected
  // 1.0× expected → ~92%; faster → toward 100; 2× slow → ~45
  const raw = 100 / Math.max(0.55, ratio);
  const errPenalty = (f.errors / Math.max(1, f.attempts)) * 18;
  return Math.max(0, Math.min(100, Math.round(raw - errPenalty)));
}

function bandDefs(op: Op): { id: string; label: string; match: (a: number, b: number) => boolean; total: number }[] {
  if (op === "mul") {
    return Array.from({ length: 11 }, (_, i) => {
      const n = i + 2;
      return {
        id: `mul-${n}`,
        label: `${n}×`,
        match: (a: number, b: number) => Math.min(a, b) === n || Math.max(a, b) === n,
        // unique pairs involving n in 2–12 triangle-ish; approximate 11 cells per row feel
        total: 11,
      };
    });
  }
  if (op === "div") {
    return Array.from({ length: 11 }, (_, i) => {
      const n = i + 2;
      return {
        id: `div-${n}`,
        label: `÷${n}`,
        match: (_a: number, b: number) => b === n,
        total: 11,
      };
    });
  }
  if (op === "add") {
    const ranges: [string, string, number, number, number][] = [
      ["add-s", "2–20", 2, 20, 40],
      ["add-m", "21–50", 21, 50, 40],
      ["add-l", "51–100", 51, 100, 40],
      ["add-xl", "100+", 101, 9999, 20],
    ];
    return ranges.map(([id, label, lo, hi, total]) => ({
      id,
      label,
      match: (a: number, b: number) => {
        const s = a + b;
        return s >= lo && s <= hi;
      },
      total,
    }));
  }
  // sub — by minuend size
  const ranges: [string, string, number, number, number][] = [
    ["sub-s", "≤20", 0, 20, 30],
    ["sub-m", "21–50", 21, 50, 30],
    ["sub-l", "51–100", 51, 100, 30],
    ["sub-xl", "100+", 101, 9999, 20],
  ];
  return ranges.map(([id, label, lo, hi, total]) => ({
    id,
    label,
    match: (a: number, _b: number) => a >= lo && a <= hi,
    total,
  }));
}

function factsForOp(facts: FactMap, op: Op): FactStat[] {
  return Object.values(facts).filter((f) => f.op === op && f.attempts > 0);
}

export function buildOpPerformance(
  facts: FactMap,
  sessions: Session[],
  op: Op,
): OpPerformance {
  const list = factsForOp(facts, op);
  const attempts = list.reduce((s, f) => s + f.attempts, 0);
  const correct = list.reduce((s, f) => s + f.correct, 0);
  const fluencies = list.map(fluencyFromFact);
  const fluencyPct =
    fluencies.length === 0
      ? null
      : Math.round(fluencies.reduce((a, b) => a + b, 0) / fluencies.length);
  const accuracyPct =
    attempts === 0 ? null : Math.round((100 * correct) / Math.max(1, attempts));

  const defs = bandDefs(op);
  const bands: OpBand[] = defs.map((d) => {
    const inBand = list.filter((f) => d.match(f.a, f.b));
    const seen = inBand.length;
    const bandAttempts = inBand.reduce((s, f) => s + f.attempts, 0);
    const avgMs =
      bandAttempts === 0
        ? null
        : inBand.reduce((s, f) => s + f.emaMs * f.attempts, 0) / bandAttempts;
    const flu =
      inBand.length === 0
        ? null
        : Math.round(
            inBand.map(fluencyFromFact).reduce((a, b) => a + b, 0) /
              inBand.length,
          );
    return {
      id: d.id,
      label: d.label,
      fluency: flu,
      attempts: bandAttempts,
      seen,
      total: d.total,
      avgMs,
    };
  });

  const coverageSeen = bands.reduce((s, b) => s + Math.min(b.seen, b.total), 0);
  const coverageTotal = bands.reduce((s, b) => s + b.total, 0);
  const coveragePct =
    coverageTotal === 0
      ? 0
      : Math.round((100 * coverageSeen) / coverageTotal);

  // Session history: fluency proxy from avg ms vs expected for that op's events
  const history: OpPerformance["history"] = [];
  const completed = sessions.filter((s) => s.completed);
  completed.slice(-16).forEach((s, idx) => {
    const row = s.perOp.find((p) => p.op === op);
    if (!row || row.n === 0) return;
    const avg = row.totalMs / row.n;
    // Use a representative expected ms for the op
    const exp =
      op === "mul"
        ? expectedMs("mul", 7, 8)
        : op === "div"
          ? expectedMs("div", 56, 7)
          : op === "add"
            ? expectedMs("add", 40, 40)
            : expectedMs("sub", 80, 35);
    const flu = Math.max(
      0,
      Math.min(100, Math.round(100 / Math.max(0.55, avg / exp))),
    );
    history.push({
      i: idx + 1,
      label: new Date(s.at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      fluency: flu,
      n: row.n,
    });
  });

  return {
    op,
    symbol: OP_SYMBOL[op],
    label: OP_LABEL[op],
    fluencyPct,
    accuracyPct,
    coveragePct,
    attempts,
    bands,
    history,
  };
}

export const OP_PAGES: Op[] = ["add", "sub", "mul", "div"];

export function parseOpFromKey(key: string): Op | null {
  return parseFactKey(key)?.op ?? null;
}
