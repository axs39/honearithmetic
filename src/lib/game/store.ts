import { create } from "zustand";
import { applyAttempt, improvementsFrom, rankWeakFacts } from "./adaptive";
import { nextProblem } from "./generate";
import {
  bumpStreak,
  EMPTY_SAVE,
  exportSave,
  loadSave,
  parseImported,
  type SaveState,
  writeSave,
} from "./storage";
import type {
  DrillMode,
  FactMap,
  GameSettings,
  LastResult,
  Op,
  Problem,
  Session,
  SessionEvent,
  SessionOpStat,
} from "./types";
import { DEFAULT_SETTINGS, enabledOps, OPS } from "./types";

export type Phase = "idle" | "playing" | "paused" | "results";

type GameStore = SaveState & {
  hydrated: boolean;
  phase: Phase;
  gameId: number;
  problem: Problem | null;
  score: number;
  errors: number;
  events: SessionEvent[];
  recentKeys: string[];
  lastResult: LastResult | null;
  hydrate: (force?: boolean) => void;
  hydrateRemote: (save: SaveState) => void;
  persist: () => void;
  patchSettings: (partial: Partial<GameSettings>) => void;
  toggleOp: (op: Op) => void;
  startGame: (overrides?: Partial<GameSettings>) => void;
  noteAttempt: (ms: number, errors: number) => void;
  endGame: (elapsedMs: number, completed: boolean) => void;
  pause: () => void;
  resume: () => void;
  playAgain: () => void;
  goIdle: () => void;
  resetProgress: () => void;
  importJson: (raw: string) => void;
  exportJson: () => string;
};

function persistable(s: GameStore): SaveState {
  return {
    version: s.version,
    settings: s.settings,
    facts: s.facts,
    sessions: s.sessions,
    bestByDuration: s.bestByDuration,
    streak: s.streak,
    lastPlayDay: s.lastPlayDay,
  };
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...structuredClone(EMPTY_SAVE),
  hydrated: false,
  phase: "idle",
  gameId: 0,
  problem: null,
  score: 0,
  errors: 0,
  events: [],
  recentKeys: [],
  lastResult: null,

  hydrate: (force?: boolean) => {
    if (get().hydrated && !force) return;
    const loaded = loadSave();
    set({
      ...loaded,
      hydrated: true,
      phase: "idle",
      problem: null,
      score: 0,
      errors: 0,
      events: [],
      recentKeys: [],
      lastResult: null,
    });
    // Backfill best_120 onto leaderboard when signed in (auth errors ignored).
    void import("./sync-social").then(({ pushLeaderboardScoresOnce }) => pushLeaderboardScoresOnce());
  },

  hydrateRemote: (save) => {
    if (get().phase === "playing" || get().phase === "paused") return;
    set({
      ...save,
      hydrated: true,
    });
    writeSave(save);
    void import("./sync-social").then(({ pushLeaderboardScoresOnce }) => pushLeaderboardScoresOnce());
  },

  persist: () => {
    writeSave(persistable(get()));
  },

  patchSettings: (partial) => {
    set((s) => ({ settings: { ...s.settings, ...partial } }));
    get().persist();
  },

  toggleOp: (op) => {
    const settings = get().settings;
    const next = { ...settings, [op]: !settings[op] };
    if (enabledOps(next).length === 0) return;
    set({ settings: next });
    get().persist();
  },

  startGame: (overrides) => {
    const settings: GameSettings = {
      ...get().settings,
      ...overrides,
    };
    if (enabledOps(settings).length === 0) {
      settings.add = true;
    }
    const problem = nextProblem(settings, get().facts, [], undefined);
    set((s) => ({
      settings,
      phase: "playing",
      gameId: s.gameId + 1,
      problem,
      score: 0,
      errors: 0,
      events: [],
      recentKeys: [],
      lastResult: null,
    }));
    get().persist();
  },

  noteAttempt: (ms, errors) => {
    const s = get();
    const problem = s.problem;
    if (!problem || s.phase !== "playing") return;
    const event: SessionEvent = {
      key: problem.key,
      op: problem.op,
      a: problem.a,
      b: problem.b,
      answer: problem.answer,
      ms,
      errors,
      prevEma: s.facts[problem.key]?.emaMs ?? null,
    };
    const facts: FactMap = applyAttempt(s.facts, event, Date.now());
    const recentKeys = [...s.recentKeys, problem.key].slice(-8);
    const next = nextProblem(s.settings, facts, recentKeys, problem.key);
    set({
      facts,
      problem: next,
      score: s.score + 1,
      errors: s.errors + errors,
      events: [...s.events, event],
      recentKeys,
    });
  },

  endGame: (elapsedMs, completed) => {
    const s = get();
    if (s.phase !== "playing" && s.phase !== "paused") return;
    const duration = s.settings.duration;
    const safeElapsed = Math.max(1, Math.min(elapsedMs, duration * 1000));
    const ppm = s.score / (safeElapsed / 60000);
    const perOp: SessionOpStat[] = OPS.map((op) => {
      const list = s.events.filter((e) => e.op === op);
      return {
        op,
        n: list.length,
        totalMs: list.reduce((sum, e) => sum + e.ms, 0),
        errors: list.reduce((sum, e) => sum + e.errors, 0),
      };
    }).filter((row) => row.n > 0);
    const session: Session = {
      id: newId(),
      at: Date.now(),
      duration,
      elapsedMs: safeElapsed,
      score: s.score,
      errors: s.errors,
      mode: s.settings.mode,
      ops: enabledOps(s.settings),
      ppm,
      perOp,
      slowest: [...s.events].sort((a, b) => b.ms - a.ms).slice(0, 6),
      completed,
    };
    const bestKey = String(duration);
    const prevBest = s.bestByDuration[bestKey] ?? 0;
    const bestByDuration =
      completed && session.score > prevBest
        ? { ...s.bestByDuration, [bestKey]: session.score }
        : s.bestByDuration;
    const streakInfo = completed
      ? bumpStreak(s.lastPlayDay, s.streak, session.at)
      : { streak: s.streak, lastPlayDay: s.lastPlayDay };
    const sessions = [...s.sessions, session].slice(-80);
    const lastResult: LastResult = {
      session,
      events: s.events,
      improvements: improvementsFrom(s.events),
      weakNow: rankWeakFacts(s.facts, s.settings).slice(0, 6),
    };
    set({
      phase: "results",
      sessions,
      bestByDuration,
      streak: streakInfo.streak,
      lastPlayDay: streakInfo.lastPlayDay,
      lastResult,
      problem: null,
    });
    get().persist();
    // Server streak / best_120 — guests and auth errors are ignored.
    void import("./leaderboard")
      .then(async ({ recordQualifiedRound }) => {
        const { clientTimeZone } = await import("./sync-social");
        return recordQualifiedRound({
          data: {
            score: session.score,
            duration: session.duration,
            completed: session.completed,
            timeZone: clientTimeZone(),
          },
        });
      })
      .catch(() => {});
  },

  pause: () => {
    if (get().phase === "playing") set({ phase: "paused" });
  },
  resume: () => {
    if (get().phase === "paused") set({ phase: "playing" });
  },
  playAgain: () => get().startGame(),
  goIdle: () => set({ phase: "idle", problem: null, lastResult: null }),
  resetProgress: () => {
    const settings = get().settings;
    set({
      ...structuredClone(EMPTY_SAVE),
      settings,
      hydrated: true,
      phase: "idle",
      problem: null,
      lastResult: null,
      events: [],
      recentKeys: [],
      score: 0,
      errors: 0,
    });
    get().persist();
  },
  importJson: (raw) => {
    const next = parseImported(raw);
    set({ ...next, hydrated: true, phase: "idle", problem: null });
    get().persist();
  },
  exportJson: () => exportSave(persistable(get())),
}));

export function modeLabel(mode: DrillMode): string {
  if (mode === "classic") return "Classic";
  if (mode === "focus") return "Focus";
  return "Adaptive";
}

export { DEFAULT_SETTINGS };
