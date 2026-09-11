import { useMemo, useState } from "react";
import { expectedMs, slowness } from "@/lib/game/adaptive";
import { formatMs } from "@/lib/game/format";
import type { FactMap } from "@/lib/game/types";
import { cn } from "@/lib/utils";

const CELLS = Array.from({ length: 11 }, (_, i) => i + 2);

function cellFact(facts: FactMap, a: number, b: number) {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return facts[`mul:${lo}:${hi}`];
}

function cellColor(ratio: number | null): string {
  if (ratio == null) return "var(--color-heat-empty)";
  const t = Math.max(0, Math.min(1, (ratio - 0.7) / 1.1));
  return `color-mix(in oklab, var(--color-heat-fast) ${(1 - t) * 100}%, var(--color-heat-slow))`;
}

export function MulHeatmap({ facts }: { facts: FactMap }) {
  const [sel, setSel] = useState<{ a: number; b: number } | null>(null);
  const selected = sel ? cellFact(facts, sel.a, sel.b) : null;
  const covered = useMemo(() => {
    let n = 0;
    for (const a of CELLS) {
      for (const b of CELLS) {
        if (a > b) continue;
        if (cellFact(facts, a, b)?.attempts) n += 1;
      }
    }
    return n;
  }, [facts]);

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xs font-medium tracking-wide text-muted uppercase">
            Multiplication table
          </h2>
          <p className="mt-1 text-sm text-muted">
            2–12 · {covered} of 66 unique facts seen
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-subtle">
          <span
            className="size-2.5 rounded-xs"
            style={{ background: "var(--color-heat-fast)" }}
          />
          Fast
          <span
            className="size-2.5 rounded-xs"
            style={{ background: "var(--color-heat-slow)" }}
          />
          Slow
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <div
          className="grid min-w-[280px] gap-1"
          style={{ gridTemplateColumns: "1.4rem repeat(11, minmax(0, 1fr))" }}
        >
          <div />
          {CELLS.map((b) => (
            <div
              key={`h-${b}`}
              className="text-center font-mono text-[10px] tabular-nums text-subtle"
            >
              {b}
            </div>
          ))}
          {CELLS.map((a) => (
            <div key={`row-${a}`} className="contents">
              <div className="flex items-center font-mono text-[10px] tabular-nums text-subtle">
                {a}
              </div>
              {CELLS.map((b) => {
                const fact = cellFact(facts, a, b);
                const ratio = fact && fact.attempts > 0 ? slowness(fact) : null;
                const isSel = sel?.a === a && sel?.b === b;
                return (
                  <button
                    key={`${a}x${b}`}
                    type="button"
                    onClick={() => setSel({ a, b })}
                    className={cn(
                      "aspect-square min-h-7 rounded-xs transition-[transform,box-shadow] duration-150",
                      isSel && "ring-1 ring-fg/70",
                    )}
                    style={{ background: cellColor(ratio) }}
                    aria-label={`${a} times ${b}${
                      fact ? `, ${formatMs(fact.emaMs)}` : ", no data"
                    }`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 min-h-10 text-sm text-muted">
        {sel ? (
          selected && selected.attempts > 0 ? (
            <p>
              <span className="font-mono tabular-nums text-fg">
                {sel.a} × {sel.b}
              </span>
              {" · "}
              {formatMs(selected.emaMs)} avg · {selected.attempts} tries
              {selected.errors ? ` · ${selected.errors} misses` : ""}
              {" · expected "}
              {formatMs(expectedMs("mul", sel.a, sel.b))}
            </p>
          ) : (
            <p>
              <span className="font-mono tabular-nums text-fg">
                {sel.a} × {sel.b}
              </span>
              {" · not seen yet"}
            </p>
          )
        ) : (
          <p className="text-subtle">Tap a cell for detail.</p>
        )}
      </div>
    </div>
  );
}
