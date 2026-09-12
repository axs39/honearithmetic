/** Device storage, namespaced by signed-in user vs guest. */

const mem = new Map<string, string>();

const GUEST = "guest";

const APP_KEYS = [
  "hone.traineeName",
  "hone.introDone",
  "hone.introStep",
  "hone.onboarded",
  "hone.save.v1",
  "hone.signupHintDismissed",
] as const;

let scope = GUEST;
let scopeReady = false;

function namespaced(key: string): string {
  return `${scope}|${key}`;
}

/** AppShell must not hydrate guest defaults before SessionBoot sets u:/guest. */
export function markKvScopeReady(): void {
  scopeReady = true;
}

export function isKvScopeReady(): boolean {
  return scopeReady;
}

function storeGet(store: Storage, key: string): string | null {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

function storeSet(store: Storage, key: string, value: string): void {
  try {
    store.setItem(key, value);
  } catch {
    /* blocked */
  }
}

function storeRemove(store: Storage, key: string): void {
  try {
    store.removeItem(key);
  } catch {
    /* blocked */
  }
}

export function getKvScope(): string {
  return scope;
}

export function setKvScope(next: string): boolean {
  const n = next.trim() || GUEST;
  if (scope === n) return false;
  scope = n;
  return true;
}

export function kvGet(key: string): string | null {
  const k = namespaced(key);
  if (typeof window !== "undefined") {
    const local = storeGet(window.localStorage, k);
    if (local != null) return local;
    const session = storeGet(window.sessionStorage, k);
    if (session != null) return session;
  }
  return mem.get(k) ?? null;
}

export function kvSet(key: string, value: string): void {
  const k = namespaced(key);
  mem.set(k, value);
  if (typeof window === "undefined") return;
  storeSet(window.localStorage, k, value);
  storeSet(window.sessionStorage, k, value);
}

export function kvRemove(key: string): void {
  const k = namespaced(key);
  mem.delete(k);
  if (typeof window === "undefined") return;
  storeRemove(window.localStorage, k);
  storeRemove(window.sessionStorage, k);
}

export function kvClearScope(target: string): void {
  const prev = scope;
  scope = target.trim() || GUEST;
  for (const key of APP_KEYS) kvRemove(key);
  scope = prev;
}

export function kvReadScope(target: string): Record<string, string | null> {
  const prev = scope;
  scope = target.trim() || GUEST;
  const out: Record<string, string | null> = {};
  for (const key of APP_KEYS) out[key] = kvGet(key);
  scope = prev;
  return out;
}

/** Drop pre-namespace keys so a signed-out guest is not still "Arnav". */
export function wipeLegacyUnscoped(): void {
  if (typeof window === "undefined") return;
  const mark = "hone.ns.v2";
  try {
    if (window.localStorage.getItem(mark) === "1") return;
  } catch {
    return;
  }
  for (const key of APP_KEYS) {
    mem.delete(key);
    storeRemove(window.localStorage, key);
    storeRemove(window.sessionStorage, key);
  }
  storeSet(window.localStorage, mark, "1");
  storeSet(window.sessionStorage, mark, "1");
}

export function wipeAllHoneKeys(): void {
  if (typeof window === "undefined") return;
  const keep = new Set(["hone.forceGuest"]);
  const drop = (store: Storage) => {
    const keys: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (k) keys.push(k);
    }
    for (const k of keys) {
      if (keep.has(k)) continue;
      if (
        k.startsWith("guest|") ||
        k.startsWith("u:") ||
        k.startsWith("hone.")
      ) {
        storeRemove(store, k);
      }
    }
  };
  try {
    drop(window.localStorage);
  } catch {
    /* blocked */
  }
  try {
    drop(window.sessionStorage);
  } catch {
    /* blocked */
  }
  for (const k of [...mem.keys()]) {
    if (k === "hone.forceGuest") continue;
    if (k.startsWith("guest|") || k.startsWith("u:") || k.includes("hone.")) {
      mem.delete(k);
    }
  }
}

export function canUseLocalStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const k = "hone.__probe";
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}
