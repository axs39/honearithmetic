import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import {
  BENCH_SECONDS,
  RANKS,
  SCALE_MAX,
  bestCompare120,
  nextRank,
  rankFor,
} from "@/lib/game/ranks";
import { formatDurationLabel, formatPpm } from "@/lib/game/format";
import { useGameStore } from "@/lib/game/store";
import { cn } from "@/lib/utils";

/** Fast early, ease near the end. Total duration under 2.5s. */
const COUNT_MS = 2200;

function easeOutExpo(t: number): number {
  if (t >= 1) return 1;
  if (t <= 0) return 0;
  return 1 - Math.pow(2, -10 * t);
}

function useCountUp(target: number, enabled: boolean): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!enabled || target <= 0) {
      setValue(0);
      return;
    }

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setValue(Math.round(target));
      return;
    }

    setValue(0);
    let raf = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / COUNT_MS);
      const eased = easeOutExpo(t);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else setValue(Math.round(target));
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, enabled]);

  return value;
}

export function CompareView() {
  const hydrated = useGameStore((s) => s.hydrated);
  const sessions = useGameStore((s) => s.sessions);
  const bestByDuration = useGameStore((s) => s.bestByDuration);

  const { score, source } = bestCompare120(sessions, bestByDuration);
  const shown = useCountUp(score, hydrated && source != null && score > 0);
  const rank = rankFor(score);
  const next = nextRank(score);
  const youPct = Math.max(
    2,
    Math.min(98, ((shown || 0) / SCALE_MAX) * 100),
  );
  const rankMarks = RANKS.filter((r) => r.min > 0);

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl pt-2">
        <h1 className="font-display text-3xl tracking-tight sm:text-4xl">
          Compare
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
          Your best 120-second classic round sets your rank, from Bronze to
          Master.
        </p>

        <section className="mt-8 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] sm:p-6">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">
            Your rank
          </p>
          {!hydrated || source === null ? (
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Play a completed {formatDurationLabel(BENCH_SECONDS)} classic
              round to place yourself. That’s the classic mix: all four
              operations, addition 2–100, multiplication 2–12 × 2–100.
            </p>
          ) : (
            <>
              <div className="mt-4 flex items-end justify-between gap-4">
                <div>
                  <p className="font-display text-5xl tabular-nums tracking-tight text-fg">
                    {shown}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {formatDurationLabel(BENCH_SECONDS)} best
                  </p>
                </div>
                <p className="max-w-[14rem] text-right text-sm text-muted">
                  {next ? `${next.needed} to ${next.rank.label}` : "Top rank"}
                </p>
              </div>

              <div className="relative mt-8 mb-10 h-2 rounded-full bg-surface-2">
                <span
                  className="absolute top-0 h-2 rounded-full bg-accent/40"
                  style={{ width: `${youPct}%` }}
                />
                {rankMarks.map((r, i) => (
                  <Marker
                    key={r.label}
                    left={(r.min / SCALE_MAX) * 100}
                    label={r.label}
                    above={i % 2 === 1}
                  />
                ))}
                <span
                  className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg shadow-[var(--shadow-border-hover)]"
                  style={{ left: `${youPct}%` }}
                  title="You"
                />
              </div>
              <div className="mt-6 flex justify-between font-mono text-[11px] tabular-nums text-subtle">
                <span>0</span>
                <span>{SCALE_MAX}+</span>
              </div>

              <p className="mt-4 text-sm text-fg">
                <span className="font-medium">{rank.label}.</span>{" "}
                <span className="text-muted">{rank.detail}</span>
              </p>
            </>
          )}
        </section>

        <section className="mt-4 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] sm:p-6">
          <h2 className="text-xs font-medium tracking-wide text-muted uppercase">
            Ranks
          </h2>
          <ul className="mt-3 divide-y divide-border">
            {RANKS.map((b) => {
              const active =
                source != null && score >= b.min && score < b.max;
              return (
                <li
                  key={b.label}
                  className={cn(
                    "flex items-baseline justify-between gap-4 py-3",
                    active && "text-fg",
                  )}
                >
                  <div>
                    <p
                      className={cn(
                        "text-sm font-medium",
                        active ? "text-fg" : "text-muted",
                      )}
                    >
                      {b.label}
                      {active ? " · you" : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-subtle">{b.detail}</p>
                  </div>
                  <span className="font-mono shrink-0 text-sm tabular-nums text-muted">
                    {b.max >= 200 ? `${b.min}+` : `${b.min}–${b.max}`}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="mt-4 mb-8 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] sm:p-6">
          <h2 className="text-xs font-medium tracking-wide text-muted uppercase">
            Rank pace
          </h2>
          <ul className="mt-3 space-y-3 text-sm">
            {rankMarks.map((r) => (
              <Mark
                key={r.label}
                label={r.label}
                value={`${r.min}+`}
                hint={`~${formatPpm(r.min / 2)} per minute`}
              />
            ))}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}

function Marker({
  left,
  label,
  strong = false,
  above = false,
}: {
  left: number;
  label: string;
  strong?: boolean;
  above?: boolean;
}) {
  return (
    <span
      className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${left}%` }}
    >
      <span
        className={cn("block h-3 w-px", strong ? "bg-fg" : "bg-muted")}
      />
      <span
        className={cn(
          "absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] tracking-wide text-subtle uppercase",
          above ? "bottom-4" : "top-4",
        )}
      >
        {label}
      </span>
    </span>
  );
}

function Mark({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <li className="flex items-baseline justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className="font-mono tabular-nums text-fg">
        {value}
        <span className="text-subtle"> · {hint}</span>
      </span>
    </li>
  );
}
