import { useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/layout/app-shell";
import { OpPerformancePanel } from "@/components/progress/op-performance";
import { Button } from "@/components/ui/button";
import { mulCoverage, rankWeakFacts } from "@/lib/game/adaptive";
import { formatDurationLabel, formatMs, formatPpm } from "@/lib/game/format";
import { modeLabel, useGameStore } from "@/lib/game/store";
import { OP_LABEL, OP_SYMBOL, problemText } from "@/lib/game/types";

export function ProgressView() {
  const hydrated = useGameStore((s) => s.hydrated);
  const facts = useGameStore((s) => s.facts);
  const sessions = useGameStore((s) => s.sessions);
  const streak = useGameStore((s) => s.streak);
  const bestByDuration = useGameStore((s) => s.bestByDuration);
  const resetProgress = useGameStore((s) => s.resetProgress);
  const exportJson = useGameStore((s) => s.exportJson);
  const importJson = useGameStore((s) => s.importJson);
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const completed = sessions.filter((s) => s.completed);
  const weak = useMemo(() => rankWeakFacts(facts).slice(0, 10), [facts]);
  const coverage = mulCoverage(facts);
  const bestTwo = bestByDuration["120"];
  const opRollup = useMemo(() => {
    const acc = {
      add: { n: 0, ms: 0 },
      sub: { n: 0, ms: 0 },
      mul: { n: 0, ms: 0 },
      div: { n: 0, ms: 0 },
    };
    for (const s of sessions) {
      for (const row of s.perOp) {
        acc[row.op].n += row.n;
        acc[row.op].ms += row.totalMs;
      }
    }
    return acc;
  }, [sessions]);

  const chartData = completed.slice(-24).map((s, i) => ({
    i: i + 1,
    score: s.score,
    ppm: Number(s.ppm.toFixed(1)),
    label: formatDurationLabel(s.duration),
  }));

  function download() {
    const blob = new Blob([exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hone-progress.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl pt-2">
        <h1 className="font-display text-3xl tracking-tight sm:text-4xl">
          Progress
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
          Stored on this device (and synced when signed in). The streak here
          counts any finished round on this browser; the Leaderboard streak only
          credits finished rounds of 120s or longer, once per day.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Rounds" value={hydrated ? String(sessions.length) : "—"} />
          <Stat
            label="Best 120s"
            value={hydrated && bestTwo != null ? String(bestTwo) : "—"}
          />
          <Stat label="Streak" value={hydrated ? String(streak || "—") : "—"} />
          <Stat
            label="× coverage"
            value={
              hydrated ? `${coverage.seen}/${coverage.total}` : "—"
            }
          />
        </div>

        <section className="mt-8 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] sm:p-6">
          <h2 className="text-xs font-medium tracking-wide text-muted uppercase">
            Score history
          </h2>
          {!hydrated || chartData.length < 2 ? (
            <p className="mt-6 mb-2 text-sm text-muted">
              {chartData.length === 1
                ? "One round logged. Play another to see the trend."
                : "Play two completed rounds to plot a trend."}
            </p>
          ) : (
            <div className="mt-4 h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid
                    stroke="var(--color-border)"
                    vertical={false}
                  />
                  <XAxis dataKey="i" hide />
                  <YAxis
                    stroke="var(--color-subtle)"
                    tick={{ fill: "var(--color-subtle)", fontSize: 11 }}
                    width={32}
                    allowDecimals={false}
                  />
                  <RTooltip
                    contentStyle={{
                      background: "var(--color-surface-2)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelFormatter={(_, payload) => {
                      const row = payload?.[0]?.payload as
                        | { label?: string }
                        | undefined;
                      return row?.label ?? "";
                    }}
                    formatter={(value) => [String(value), "Score"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="var(--color-accent)"
                    fill="var(--color-accent)"
                    fillOpacity={0.14}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="mt-4 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] sm:p-6">
          <h2 className="text-xs font-medium tracking-wide text-muted uppercase">
            By operation
          </h2>
          <ul className="mt-3 divide-y divide-border">
            {(["add", "sub", "mul", "div"] as const).map((op) => {
              const row = opRollup[op];
              return (
                <li
                  key={op}
                  className="flex items-baseline justify-between py-2.5"
                >
                  <span className="flex items-center gap-2 text-sm">
                    <span className="font-display w-4 text-lg text-muted">
                      {OP_SYMBOL[op]}
                    </span>
                    {OP_LABEL[op]}
                  </span>
                  <span className="font-mono text-sm tabular-nums text-muted">
                    {row.n === 0
                      ? "—"
                      : `${row.n} · ${formatMs(row.ms / row.n)} avg`}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="mt-4 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] sm:p-6">
          <OpPerformancePanel facts={facts} sessions={sessions} />
        </section>

        <section className="mt-4 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] sm:p-6">
          <h2 className="text-xs font-medium tracking-wide text-muted uppercase">
            Weak facts
          </h2>
          {weak.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              Facts with at least two attempts will land here, slowest first.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {weak.map((f) => (
                <li
                  key={f.key}
                  className="flex items-baseline justify-between font-mono text-sm tabular-nums"
                >
                  <span className="text-fg">
                    {problemText({
                      op: f.op,
                      a: f.a,
                      b: f.b,
                      answer: 0,
                      key: f.key,
                    })}
                  </span>
                  <span className="text-muted">
                    {formatMs(f.emaMs)} · {f.attempts}×
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-4 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] sm:p-6">
          <h2 className="text-xs font-medium tracking-wide text-muted uppercase">
            Recent sessions
          </h2>
          {sessions.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No sessions yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {[...sessions].reverse().slice(0, 12).map((s) => (
                <li
                  key={s.id}
                  className="flex items-baseline justify-between gap-3 py-2.5 text-sm"
                >
                  <span className="text-muted">
                    {new Date(s.at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                    {" · "}
                    {modeLabel(s.mode)}
                    {" · "}
                    {formatDurationLabel(s.duration)}
                    {s.completed ? "" : " · partial"}
                  </span>
                  <span className="font-mono tabular-nums text-fg">
                    {s.score}
                    <span className="text-subtle">
                      {" "}
                      · {formatPpm(s.ppm)}/min
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-4 mb-8 flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={download}>
            Export progress
          </Button>
          <Button variant="ghost" onClick={() => fileRef.current?.click()}>
            Import
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              void file.text().then((t) => {
                try {
                  importJson(t);
                } catch {
                  /* ignore malformed */
                }
              });
              e.target.value = "";
            }}
          />
          {confirmReset ? (
            <Button
              variant="outline"
              onClick={() => {
                resetProgress();
                setConfirmReset(false);
              }}
              className="text-terra"
            >
              Confirm reset
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmReset(true)}>
              Reset progress
            </Button>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface px-3 py-3 shadow-[var(--shadow-border)]">
      <p className="text-[11px] tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-1 font-mono text-2xl tabular-nums text-fg">{value}</p>
    </div>
  );
}
