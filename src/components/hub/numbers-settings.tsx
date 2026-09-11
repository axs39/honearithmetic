import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  RANGE_PRESETS,
  type GameSettings,
  type Range,
} from "@/lib/game/types";
import { cn } from "@/lib/utils";

export function NumbersSettings({
  settings,
  onPatch,
}: {
  settings: GameSettings;
  onPatch: (partial: Partial<GameSettings>) => void;
}) {
  const activeId = RANGE_PRESETS.find((p) => presetMatches(p, settings))?.id;

  return (
    <div className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] sm:p-6">
      <p className="text-xs font-medium tracking-wide text-muted uppercase">
        Your numbers
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Set the operands that appear. Subtraction is addition reversed.
        Division is multiplication reversed.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {RANGE_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() =>
              onPatch({
                addLeft: p.addLeft,
                addRight: p.addRight,
                mulLeft: p.mulLeft,
                mulRight: p.mulRight,
              })
            }
            className={cn(
              "h-11 rounded-sm px-3 text-sm shadow-[var(--shadow-border)] transition-colors duration-150",
              activeId === p.id
                ? "bg-primary text-primary-fg"
                : "bg-bg/40 text-muted hover:text-fg",
            )}
            title={p.blurb}
          >
            {p.name}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <RangeCard
          title="Addition & subtraction"
          hint="Left and right of +  ·  subtraction uses (a + b) − a"
          left={settings.addLeft}
          right={settings.addRight}
          onChange={(side, range) =>
            onPatch(side === "left" ? { addLeft: range } : { addRight: range })
          }
          symbol="+"
        />
        <RangeCard
          title="Multiplication & division"
          hint="Left and right of ×  ·  division uses (a × b) ÷ a"
          left={settings.mulLeft}
          right={settings.mulRight}
          onChange={(side, range) =>
            onPatch(side === "left" ? { mulLeft: range } : { mulRight: range })
          }
          symbol="×"
        />
      </div>
    </div>
  );
}

function presetMatches(
  p: (typeof RANGE_PRESETS)[number],
  s: GameSettings,
): boolean {
  return (
    rangeEq(p.addLeft, s.addLeft) &&
    rangeEq(p.addRight, s.addRight) &&
    rangeEq(p.mulLeft, s.mulLeft) &&
    rangeEq(p.mulRight, s.mulRight)
  );
}

function rangeEq(a: Range, b: Range): boolean {
  return a.min === b.min && a.max === b.max;
}

function RangeCard({
  title,
  hint,
  left,
  right,
  onChange,
  symbol,
}: {
  title: string;
  hint: string;
  left: Range;
  right: Range;
  onChange: (side: "left" | "right", range: Range) => void;
  symbol: string;
}) {
  return (
    <div className="rounded-lg bg-bg/50 p-4">
      <p className="text-sm font-medium text-fg">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-subtle">{hint}</p>
      <div className="mt-3 flex items-end gap-2">
        <RangeInputs
          label="Left"
          range={left}
          onChange={(r) => onChange("left", r)}
        />
        <span className="mb-2 font-display text-lg text-muted">{symbol}</span>
        <RangeInputs
          label="Right"
          range={right}
          onChange={(r) => onChange("right", r)}
        />
      </div>
    </div>
  );
}

function RangeInputs({
  label,
  range,
  onChange,
}: {
  label: string;
  range: Range;
  onChange: (r: Range) => void;
}) {
  return (
    <div className="flex-1">
      <Label>{label}</Label>
      <div className="mt-1 flex items-center gap-1.5">
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          max={9999}
          value={range.min}
          onChange={(e) =>
            onChange({
              min: Number(e.target.value),
              max: range.max,
            })
          }
          aria-label={`${label} min`}
        />
        <span className="text-subtle">–</span>
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          max={9999}
          value={range.max}
          onChange={(e) =>
            onChange({
              min: range.min,
              max: Number(e.target.value),
            })
          }
          aria-label={`${label} max`}
        />
      </div>
    </div>
  );
}
