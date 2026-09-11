import {
  DEFAULT_SETTINGS,
  type FactMap,
  type GameSettings,
  type Range,
  type Session,
} from "./types";
import { localDay } from "./format";
import { kvGet, kvSet } from "./persist";

export const SAVE_VERSION = 1;
const KEY = "hone.save.v1";

export type SaveState = {
  version: number;
  settings: GameSettings;
  facts: FactMap;
  sessions: Session[];
  bestByDuration: Record<string, number>;
  streak: number;
  lastPlayDay: string | null;
};

export const EMPTY_SAVE: SaveState = {
  version: SAVE_VERSION,
  settings: { ...DEFAULT_SETTINGS },
  facts: {},
  sessions: [],
  bestByDuration: {},
  streak: 0,
  lastPlayDay: null,
};

function clampRange(r: Range | undefined, fallback: Range): Range {
  if (!r || !Number.isFinite(r.min) || !Number.isFinite(r.max)) return fallback;
  const min = Math.max(0, Math.min(9999, Math.round(r.min)));
  const max = Math.max(0, Math.min(9999, Math.round(r.max)));
  return min <= max ? { min, max } : { min: max, max: min };
}

function migrate(raw: unknown): SaveState {
  if (!raw || typeof raw !== "object") return structuredClone(EMPTY_SAVE);
  const s = raw as Partial<SaveState> & { version?: number };
  const settings: GameSettings = {
    ...DEFAULT_SETTINGS,
    ...(s.settings ?? {}),
    addLeft: clampRange(s.settings?.addLeft, DEFAULT_SETTINGS.addLeft),
    addRight: clampRange(s.settings?.addRight, DEFAULT_SETTINGS.addRight),
    mulLeft: clampRange(s.settings?.mulLeft, DEFAULT_SETTINGS.mulLeft),
    mulRight: clampRange(s.settings?.mulRight, DEFAULT_SETTINGS.mulRight),
    duration: [30, 60, 120, 180, 300, 600].includes(s.settings?.duration as number)
      ? (s.settings!.duration as number)
      : 120,
    mode:
      s.settings?.mode === "classic" ||
      s.settings?.mode === "adaptive" ||
      s.settings?.mode === "focus"
        ? s.settings.mode
        : "adaptive",
    sound: s.settings?.sound !== false,
  };
  return {
    version: SAVE_VERSION,
    settings,
    facts: s.facts && typeof s.facts === "object" ? s.facts : {},
    sessions: Array.isArray(s.sessions) ? s.sessions.slice(-80) : [],
    bestByDuration:
      s.bestByDuration && typeof s.bestByDuration === "object"
        ? s.bestByDuration
        : {},
    streak: Number.isFinite(s.streak) ? Number(s.streak) : 0,
    lastPlayDay: typeof s.lastPlayDay === "string" ? s.lastPlayDay : null,
  };
}

export function loadSave(): SaveState {
  if (typeof window === "undefined") return structuredClone(EMPTY_SAVE);
  try {
    const raw = kvGet(KEY);
    if (!raw) return structuredClone(EMPTY_SAVE);
    return migrate(JSON.parse(raw));
  } catch {
    return structuredClone(EMPTY_SAVE);
  }
}

export function writeSave(state: SaveState): void {
  if (typeof window === "undefined") return;
  try {
    const payload: SaveState = {
      ...state,
      version: SAVE_VERSION,
      sessions: state.sessions.slice(-80),
    };
    kvSet(KEY, JSON.stringify(payload));
  } catch {
    // private mode / quota — keep running in memory
  }
}

export function bumpStreak(
  lastPlayDay: string | null,
  streak: number,
  now = Date.now(),
): { streak: number; lastPlayDay: string } {
  const today = localDay(now);
  if (lastPlayDay === today) return { streak, lastPlayDay: today };
  if (!lastPlayDay) return { streak: 1, lastPlayDay: today };
  const prev = new Date(`${lastPlayDay}T12:00:00`);
  const diff = Math.round((now - prev.getTime()) / 86_400_000);
  if (diff === 1 || (diff === 0 && lastPlayDay !== today)) {
    return { streak: streak + 1, lastPlayDay: today };
  }
  if (diff <= 1) return { streak: streak + 1, lastPlayDay: today };
  return { streak: 1, lastPlayDay: today };
}

export function exportSave(state: SaveState): string {
  return JSON.stringify({ ...state, version: SAVE_VERSION }, null, 2);
}

export function parseImported(raw: string): SaveState {
  return migrate(JSON.parse(raw));
}
