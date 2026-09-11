export function formatClock(totalSeconds: number): string {
  return String(Math.max(0, Math.ceil(totalSeconds)));
}

export function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatPpm(ppm: number): string {
  if (!Number.isFinite(ppm)) return "—";
  return ppm.toFixed(1);
}

export function formatDurationLabel(seconds: number): string {
  return `${Math.max(0, Math.round(seconds))}s`;
}

export function localDay(ts: number = Date.now()): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
