export type Op = "add" | "sub" | "mul" | "div";
export type DrillMode = "classic" | "adaptive" | "focus";

export type Range = { min: number; max: number };

export type GameSettings = {
  add: boolean;
  sub: boolean;
  mul: boolean;
  div: boolean;
  addLeft: Range;
  addRight: Range;
  mulLeft: Range;
  mulRight: Range;
  duration: number;
  mode: DrillMode;
  sound: boolean;
};

export type Problem = {
  op: Op;
  a: number;
  b: number;
  answer: number;
  key: string;
};

export type FactStat = {
  key: string;
  op: Op;
  a: number;
  b: number;
  attempts: number;
  correct: number;
  errors: number;
  emaMs: number;
  lastMs: number;
  lastSeen: number;
};

export type FactMap = Record<string, FactStat>;

export type SessionOpStat = {
  op: Op;
  n: number;
  totalMs: number;
  errors: number;
};

export type SessionEvent = {
  key: string;
  op: Op;
  a: number;
  b: number;
  answer: number;
  ms: number;
  errors: number;
  prevEma: number | null;
};

export type Session = {
  id: string;
  at: number;
  duration: number;
  elapsedMs: number;
  score: number;
  errors: number;
  mode: DrillMode;
  ops: Op[];
  ppm: number;
  perOp: SessionOpStat[];
  slowest: SessionEvent[];
  completed: boolean;
};

export type LastResult = {
  session: Session;
  events: SessionEvent[];
  improvements: SessionEvent[];
  weakNow: FactStat[];
};

export const OPS: Op[] = ["add", "sub", "mul", "div"];

export const OP_SYMBOL: Record<Op, string> = {
  add: "+",
  sub: "−",
  mul: "×",
  div: "÷",
};

export const OP_LABEL: Record<Op, string> = {
  add: "Addition",
  sub: "Subtraction",
  mul: "Multiplication",
  div: "Division",
};

export const DURATIONS = [30, 60, 120, 180, 300, 600] as const;

/** Official leaderboard round: Classic 120s, all ops, desk ranges. */
export const BOARD_STANDARD = {
  duration: 120,
  mode: "classic" as const,
  add: true,
  sub: true,
  mul: true,
  div: true,
  addLeft: { min: 2, max: 100 },
  addRight: { min: 2, max: 100 },
  mulLeft: { min: 2, max: 12 },
  mulRight: { min: 2, max: 100 },
} as const;

export const DEFAULT_SETTINGS: GameSettings = {
  add: true,
  sub: true,
  mul: true,
  div: true,
  addLeft: { min: 2, max: 100 },
  addRight: { min: 2, max: 100 },
  mulLeft: { min: 2, max: 12 },
  mulRight: { min: 2, max: 100 },
  duration: 120,
  mode: "classic",
  sound: true,
};

function rangeEq(
  a: { min: number; max: number },
  b: { min: number; max: number },
): boolean {
  return a.min === b.min && a.max === b.max;
}

/** True only for the official default round (mods / custom ops do not count). */
export function isBoardStandardSettings(
  s: Pick<
    GameSettings,
    | "duration"
    | "mode"
    | "add"
    | "sub"
    | "mul"
    | "div"
    | "addLeft"
    | "addRight"
    | "mulLeft"
    | "mulRight"
  >,
): boolean {
  return (
    s.duration === BOARD_STANDARD.duration &&
    s.mode === BOARD_STANDARD.mode &&
    s.add === true &&
    s.sub === true &&
    s.mul === true &&
    s.div === true &&
    rangeEq(s.addLeft, BOARD_STANDARD.addLeft) &&
    rangeEq(s.addRight, BOARD_STANDARD.addRight) &&
    rangeEq(s.mulLeft, BOARD_STANDARD.mulLeft) &&
    rangeEq(s.mulRight, BOARD_STANDARD.mulRight)
  );
}

export function isBoardEligibleSession(session: {
  completed: boolean;
  duration: number;
  mode: DrillMode;
  ops: Op[];
  /** Optional; when absent, ops+mode+duration only (legacy). */
  boardStandard?: boolean;
}): boolean {
  if (!session.completed) return false;
  if (session.boardStandard === true) return true;
  if (session.boardStandard === false) return false;
  // Legacy sessions: require classic 120s with all four ops recorded.
  if (session.duration !== 120 || session.mode !== "classic") return false;
  const set = new Set(session.ops);
  return OPS.every((op) => set.has(op)) && session.ops.length === 4;
}

export const RANGE_PRESETS = [
  {
    id: "desk",
    name: "Desk mix",
    blurb: "Interview default — add 2–100, multiply 2–12 × 2–100",
    addLeft: { min: 2, max: 100 },
    addRight: { min: 2, max: 100 },
    mulLeft: { min: 2, max: 12 },
    mulRight: { min: 2, max: 100 },
  },
  {
    id: "tables",
    name: "Times tables",
    blurb: "2–12 on both sides of ×, small adds",
    addLeft: { min: 2, max: 20 },
    addRight: { min: 2, max: 20 },
    mulLeft: { min: 2, max: 12 },
    mulRight: { min: 2, max: 12 },
  },
  {
    id: "twodigit",
    name: "Two-digit",
    blurb: "10–99 across the board",
    addLeft: { min: 10, max: 99 },
    addRight: { min: 10, max: 99 },
    mulLeft: { min: 10, max: 99 },
    mulRight: { min: 10, max: 99 },
  },
  {
    id: "wide",
    name: "Wide",
    blurb: "Three-digit adds, larger products",
    addLeft: { min: 2, max: 999 },
    addRight: { min: 2, max: 999 },
    mulLeft: { min: 2, max: 50 },
    mulRight: { min: 2, max: 100 },
  },
] as const;

export function enabledOps(settings: GameSettings): Op[] {
  return OPS.filter((op) => settings[op]);
}

export function problemText(p: Problem): string {
  return `${p.a} ${OP_SYMBOL[p.op]} ${p.b}`;
}

