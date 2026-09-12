import { useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  OP_PAGES,
  buildOpPerformance,
  type OpPerformance,
} from "@/lib/game/op-performance";
import { formatMs } from "@/lib/game/format";
import type { FactMap, Op, Session } from "@/lib/game/types";
import { OP_LABEL, OP_SYMBOL } from "@/lib/game/types";
import { cn } from "@/lib/utils";

type Props = {
  facts: FactMap;
  sessions: Session[];
};

export function OpPerformancePanel({ facts, sessions }: Props) {
  const [op, setOp] = useState<Op>("mul");
  const [animKey, setAnimKey] = useState(0);
  const touchX = useRef<number | null>(null);

  const pages = useMemo(
    () => OP_PAGES.map((o) => buildOpPerformance(facts, sessions, o)),
    [facts, sessions],
  );
  const page = pages.find((p) => p.op === op) ?? pages[2]!;
  const idx = OP_PAGES.indexOf(op);

  function go(next: Op) {
    setOp(next);
    setAnimKey((k) => k + 1);
  }

  function shift(dir: -1 | 1) {
    const n = (idx + dir + OP_PAGES.length) % OP_PAGES.length;
    go(OP_PAGES[n]!);
  }

  useEffect(() => {
    setAnimKey((k) => k + 1);
  }, [facts, sessions]);

  const chartData = page.bands.map((b) => ({
    label: b.label,
    fluency: b.fluency ?? 0,
    hasData: b.fluency != null,
    attempts: b.attempts,
    avgMs: b.avgMs,
    coverage: b.total ? Math.round((100 * b.seen) / b.total) : 0,
  }));

  const historyData =
    page.history.length >= 2
      ? page.history
      : chartData.some((d) => d.hasData)
        ? chartData
        : [];

  const useHistory = page.history.length >= 2;

  return (
    <div
      className="op-perf-root"
      onTouchStart={(e) => {
        touchX.current = e.changedTouches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchX.current;
        touchX.current = null;
        const end = e.changedTouches[0]?.clientX;
        if (start == null || end == null) return;
        const dx = end - start;
        if (Math.abs(dx) < 48) return;
        shift(dx < 0 ? 1 : -1);
      }}
    >
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xs font-medium tracking-wide text-muted uppercase">
            Fluency by operation
          </h2>
          <p className="mt-1 text-sm text-muted">
            Swipe or tap to move between +, −, ×, ÷
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous operation"
            onClick={() => shift(-1)}
            className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Next operation"
            onClick={() => shift(1)}
            className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1">
        {OP_PAGES.map((o) => {
          const active = o === op;
          const snap = pages.find((p) => p.op === o);
          return (
            <button
              key={o}
              type="button"
              onClick={() => go(o)}
              className={cn(
                "flex min-w-[4.5rem] flex-1 flex-col items-center rounded-lg px-2 py-2 transition-colors",
                active
                  ? "bg-accent/15 text-fg ring-1 ring-accent/40"
                  : "bg-surface-2/60 text-muted hover:text-fg",
              )}
            >
              <span className="font-display text-lg leading-none">
                {OP_SYMBOL[o]}
              </span>
              <span className="mt-1 text-[10px] tracking-wide uppercase">
                {OP_LABEL[o].slice(0, 3)}
              </span>
              <span className="mt-0.5 font-mono text-xs tabular-nums">
                {snap?.fluencyPct == null ? "—" : `${snap.fluencyPct}%`}
              </span>
            </button>
          );
        })}
      </div>

      <div key={animKey} className="op-perf-enter mt-5">
        <OpHero page={page} />

        <div className="mt-5 h-56 w-full sm:h-64">
          {historyData.length === 0 ||
          (!useHistory && !chartData.some((d) => d.hasData)) ? (
            <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border px-4 text-center text-sm text-muted">
              Play a few {page.label.toLowerCase()} problems — this line fills
              in with your fluency %.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={useHistory ? historyData : chartData}
                margin={{ top: 12, right: 12, left: 0, bottom: 4 }}
              >
                <defs>
                  <linearGradient id="fluencyStroke" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="var(--color-accent)" />
                    <stop offset="100%" stopColor="var(--color-terra)" />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke="var(--color-border)"
                  vertical={false}
                  strokeDasharray="3 6"
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "var(--color-subtle)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  tickFormatter={(v) => `${v}%`}
                  stroke="var(--color-subtle)"
                  tick={{ fill: "var(--color-subtle)", fontSize: 11 }}
                  width={40}
                />
                <RTooltip
                  contentStyle={{
                    background: "var(--color-surface-2)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value, _name, item) => {
                    const row = item?.payload as {
                      fluency?: number;
                      attempts?: number;
                      avgMs?: number | null;
                      n?: number;
                      hasData?: boolean;
                    };
                    if (useHistory) {
                      return [
                        `${value}% fluency · ${row.n ?? 0} solves`,
                        page.label,
                      ];
                    }
                    if (row.hasData === false) return ["No data yet", page.label];
                    const ms =
                      row.avgMs != null ? ` · ${formatMs(row.avgMs)} avg` : "";
                    return [
                      `${value}% fluency · ${row.attempts ?? 0} tries${ms}`,
                      page.label,
                    ];
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="fluency"
                  stroke="url(#fluencyStroke)"
                  strokeWidth={3}
                  dot={{
                    r: 4,
                    strokeWidth: 2,
                    stroke: "var(--color-bg)",
                    fill: "var(--color-accent)",
                  }}
                  activeDot={{ r: 6 }}
                  isAnimationActive
                  animationDuration={1100}
                  animationEasing="ease-out"
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <p className="mt-2 text-center text-[11px] text-subtle">
          {useHistory
            ? "Line = fluency % across recent rounds for this operation"
            : "Line = fluency % across difficulty bands (empty bands sit at 0%)"}
        </p>

        <div className="mt-4 flex justify-center gap-1.5">
          {OP_PAGES.map((o) => (
            <button
              key={o}
              type="button"
              aria-label={OP_LABEL[o]}
              onClick={() => go(o)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                o === op ? "w-6 bg-accent" : "w-1.5 bg-border hover:bg-muted",
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function OpHero({ page }: { page: OpPerformance }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <HeroStat
        label="Fluency"
        value={page.fluencyPct == null ? "—" : `${page.fluencyPct}%`}
        hint="speed vs expected"
      />
      <HeroStat
        label="Accuracy"
        value={page.accuracyPct == null ? "—" : `${page.accuracyPct}%`}
        hint="correct rate"
      />
      <HeroStat
        label="Coverage"
        value={`${page.coveragePct}%`}
        hint={`${page.attempts} tries`}
      />
    </div>
  );
}

function HeroStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-lg bg-surface-2/70 px-3 py-3">
      <p className="text-[10px] tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-1 font-mono text-2xl tabular-nums text-fg">{value}</p>
      <p className="mt-0.5 text-[10px] text-subtle">{hint}</p>
    </div>
  );
}
