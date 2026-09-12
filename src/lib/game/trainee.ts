import { kvGet, kvRemove, kvSet } from "./persist";

const NAME_KEY = "hone.traineeName";
const DISPLAY_KEY = "hone.displayName";
const INTRO_KEY = "hone.introDone";
const STEP_KEY = "hone.introStep";
const GATE_KEY = "hone.displayNameGateShown";

const introListeners = new Set<() => void>();

export function subscribeIntro(onStoreChange: () => void) {
  introListeners.add(onStoreChange);
  return () => {
    introListeners.delete(onStoreChange);
  };
}

export function notifyIntro() {
  for (const fn of introListeners) fn();
}

export function normalizeDisplayName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, 32);
}

export function readTraineeName(): string {
  return normalizeDisplayName(kvGet(NAME_KEY) ?? "");
}

export function writeTraineeName(name: string): void {
  const n = normalizeDisplayName(name);
  if (!n) return;
  kvSet(NAME_KEY, n);
}

export function readPendingDisplayName(): string {
  return normalizeDisplayName(kvGet(DISPLAY_KEY) ?? "");
}

export function writePendingDisplayName(name: string): void {
  const n = normalizeDisplayName(name);
  if (!n) {
    kvRemove(DISPLAY_KEY);
    return;
  }
  kvSet(DISPLAY_KEY, n);
}

export function isIntroDone(): boolean {
  return kvGet(INTRO_KEY) === "1";
}

export type IntroStep = "hello" | "how" | "features";

export function readIntroStep(): IntroStep {
  if (isIntroDone()) return "hello";
  const s = kvGet(STEP_KEY);
  if (s === "how" || s === "features") return s;
  return "hello";
}

export function writeIntroStep(step: IntroStep): void {
  kvSet(STEP_KEY, step);
}

export function completeIntro(name: string, displayName?: string): void {
  writeTraineeName(name);
  if (displayName !== undefined) writePendingDisplayName(displayName);
  kvSet(INTRO_KEY, "1");
  kvSet("hone.onboarded", "1");
  kvRemove(STEP_KEY);
  notifyIntro();
}

export function wasDisplayNameGateShown(): boolean {
  return kvGet(GATE_KEY) === "1";
}

export function markDisplayNameGateShown(): void {
  kvSet(GATE_KEY, "1");
}
