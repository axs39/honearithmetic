import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import {
  AVG_CANDIDATE_SCORE,
  AVG_TRADER_SCORE,
  BENCH_SECONDS,
  ELITE_SCORE,
  QUANT_BANDS,
  SCALE_MAX,
  bandFor,
  bestCompare120,
  traderDelta,
} from "@/lib/game/quant";
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
  const band = bandFor(score);
  const delta = traderDelta(score);
  const youPct = Math.max(
    2,
    Math.min(98, ((shown || 0) / SCALE_MAX) * 100),
  );
  const traderPct = (AVG_TRADER_SCORE / SCALE_MAX) * 100;
  const elitePct = (ELITE_SCORE / SCALE_MAX) * 100;
  const candidatePct = (AVG_CANDIDATE_SCORE / SCALE_MAX) * 100;

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl pt-2">
        <h1 className="font-display text-3xl tracking-tight sm:text-4xl">
          Compare
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
          The 120-second default mix is the desk yardstick. A working quant
          trader typically lands around {AVG_TRADER_SCORE} on that clock. Sixty
          is rare.
        </p>

        <section className="mt-8 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] sm:p-6">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">
            You vs the desk
          </p>
          {!hydrated || source === null ? (
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Play a completed {formatDurationLabel(BENCH_SECONDS)} classic
              round to place yourself. That’s the industry mix: all four
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
                  {delta === 0
                    ? "Level with the average trader."
                    : delta > 0
                      ? `${delta} above a typical desk.`
                      : `${Math.abs(delta)} below a typical desk.`}
                </p>
              </div>

              <div className="relative mt-8 mb-10 h-2 rounded-full bg-surface-2">
                <span
                  className="absolute top-0 h-2 rounded-full bg-accent/40"
                  style={{ width: `${traderPct}%` }}
                />
                <Marker left={candidatePct} label="Prep" />
                <Marker left={traderPct} label="Trader" strong />
                <Marker left={elitePct} label="Elite" />
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
                <span className="font-medium">{band.label}.</span>{" "}
                <span className="text-muted">{band.detail}</span>
              </p>
            </>
          )}
        </section>

        <section className="mt-4 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] sm:p-6">
          <h2 className="text-xs font-medium tracking-wide text-muted uppercase">
            120s score bands
          </h2>
          <ul className="mt-3 divide-y divide-border">
            {QUANT_BANDS.map((b) => {
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
            Marks on the floor
          </h2>
          <ul className="mt-3 space-y-3 text-sm">
            <Mark
              label="Interview prep"
              value={String(AVG_CANDIDATE_SCORE)}
              hint={`~${formatPpm(AVG_CANDIDATE_SCORE / 2)} per minute`}
            />
            <Mark
              label="Average trader"
              value={String(AVG_TRADER_SCORE)}
              hint={`~${formatPpm(AVG_TRADER_SCORE / 2)} per minute`}
            />
            <Mark
              label="Elite / Optiver pace"
              value={`${ELITE_SCORE}+`}
              hint={`~${formatPpm(ELITE_SCORE / 2)} per minute`}
            />
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
}: {
  left: number;
  label: string;
  strong?: boolean;
}) {
  return (
    <span
      className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${left}%` }}
    >
      <span
        className={cn("block h-3 w-px", strong ? "bg-fg" : "bg-muted")}
      />
      <span className="absolute top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs tracking-wide text-subtle uppercase">
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
