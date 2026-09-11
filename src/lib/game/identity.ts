import {
  kvClearScope,
  setKvScope,
  wipeAllHoneKeys,
} from "./persist";
import { notifyIntro } from "./trainee";

const FORCE_KEY = "hone.forceGuest";

function rawSet(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* blocked */
  }
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    /* blocked */
  }
}

function rawGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(key);
    if (v != null) return v;
  } catch {
    /* blocked */
  }
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function rawRemove(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* blocked */
  }
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    /* blocked */
  }
}

export function isForceGuest(): boolean {
  if (typeof window === "undefined") return false;
  if (rawGet(FORCE_KEY) === "1") return true;
  try {
    return new URLSearchParams(window.location.search).get("as") === "guest";
  } catch {
    return false;
  }
}

/** Sign out on this device: stay a guest until the next explicit sign-in. */
export function beginGuestSession(): void {
  rawSet(FORCE_KEY, "1");
  wipeAllHoneKeys();
  setKvScope("guest");
  kvClearScope("guest");
  notifyIntro();
}

/** Caller just signed in on purpose — allow the account again. */
export function endGuestSession(): void {
  rawRemove(FORCE_KEY);
}

export function stripGuestQuery(): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("as")) return;
    url.searchParams.delete("as");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  } catch {
    /* ignore */
  }
}
