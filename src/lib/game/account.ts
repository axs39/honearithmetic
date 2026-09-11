export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
}

export function usernameToEmail(username: string): string {
  const n = normalizeUsername(username);
  if (n.includes("@")) return n;
  return `${n}@hone.app`;
}

export function validateUsername(raw: string): string | null {
  const n = normalizeUsername(raw);
  if (n.length < 3) return "Username needs at least 3 characters.";
  if (n.length > 20) return "Username must be 20 characters or fewer.";
  if (!/^[a-z0-9_]+$/.test(n)) return "Use letters, numbers, and underscores.";
  return null;
}

export function validatePassword(raw: string): string | null {
  if (raw.length < 8) return "Password needs at least 8 characters.";
  return null;
}
