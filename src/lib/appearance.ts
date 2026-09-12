/** Device-level theme + number font. Not scoped to guest/user. */

export type ThemeMode = "dark" | "light";
export type FontMode = "default" | "simple";

export type Appearance = {
  theme: ThemeMode;
  font: FontMode;
};

const KEY = "hone.appearance.v1";
const DEFAULT: Appearance = { theme: "dark", font: "default" };

function canStorage(): boolean {
  try {
    return typeof window !== "undefined" && Boolean(window.localStorage);
  } catch {
    return false;
  }
}

export function readAppearance(): Appearance {
  if (!canStorage()) return { ...DEFAULT };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw) as Partial<Appearance>;
    const theme: ThemeMode =
      parsed.theme === "light" || parsed.theme === "dark"
        ? parsed.theme
        : DEFAULT.theme;
    const font: FontMode =
      parsed.font === "simple" || parsed.font === "default"
        ? parsed.font
        : DEFAULT.font;
    return { theme, font };
  } catch {
    return { ...DEFAULT };
  }
}

export function writeAppearance(next: Appearance): void {
  if (!canStorage()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* blocked */
  }
}

/** Apply classes/attrs on <html> + theme-color meta. */
export function applyAppearance(a: Appearance): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", a.theme === "dark");
  root.classList.toggle("light", a.theme === "light");
  root.dataset.font = a.font;
  root.dataset.theme = a.theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute(
      "content",
      a.theme === "dark" ? "#0a0b0d" : "#f4f2ec",
    );
  }
}

export function patchAppearance(partial: Partial<Appearance>): Appearance {
  const next = { ...readAppearance(), ...partial };
  writeAppearance(next);
  applyAppearance(next);
  return next;
}
