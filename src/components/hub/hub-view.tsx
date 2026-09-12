import { Link, useNavigate } from "@tanstack/react-router";
import { Volume2, VolumeX } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { NumbersSettings } from "@/components/hub/numbers-settings";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { recommend } from "@/lib/game/adaptive";
import { formatDurationLabel, formatMs } from "@/lib/game/format";
import { modeLabel, useGameStore } from "@/lib/game/store";
import { readTraineeName } from "@/lib/game/trainee";
import {
  BOARD_STANDARD,
  DURATIONS,
  isBoardStandardSettings,
  OP_SYMBOL,
  OPS,
  type DrillMode,
  problemText,
} from "@/lib/game/types";
import { SignedIn, SignedOut } from "@/lib/auth/gates";
import { unlockAudio } from "@/lib/game/audio";
import { canUseLocalStorage } from "@/lib/game/persist";
import { cn } from "@/lib/utils";

const MODES: { id: DrillMode; name: string; blurb: string }[] = [
  {
    id: "classic",
    name: "Classic",
    blurb: "Uniform mix — default round (leaderboard).",
  },
  {
    id: "adaptive",
    name: "Adaptive",
    blurb: "Weighted toward the facts you’re slow on.",
  },
  {
    id: "focus",
    name: "Focus",
    blurb: "Almost only your current weak cluster.",
  },
];

export function HubView() {
  const navigate = useNavigate();
  const hydrated = useGameStore((s) => s.hydrated);
  const settings = useGameStore((s) => s.settings);
  const sessions = useGameStore((s) => s.sessions);
  const facts = useGameStore((s) => s.facts);
  const bestByDuration = useGameStore((s) => s.bestByDuration);
  const streak = useGameStore((s) => s.streak);
  const patchSettings = useGameStore((s) => s.patchSettings);
  const toggleOp = useGameStore((s) => s.toggleOp);
  const startGame = useGameStore((s) => s.startGame);
  const [name, setName] = useState("");

  useEffect(() => {
    setName(readTraineeName());
  }, []);

  const last = sessions[sessions.length - 1];
  const best = bestByDuration[String(settings.duration)];
  const boardEligible = isBoardStandardSettings(settings);
  const rec = useMemo(
    () => recommend(facts, sessions.length),
    [facts, sessions.length],
  );
  const weak = useMemo(() => {
    return Object.values(facts)
      .filter((f) => f.attempts >= 2)
      .sort((a, b) => b.emaMs - a.emaMs)
      .slice(0, 4);
  }, [facts]);

  function launch(overrides?: Partial<typeof settings>) {
    unlockAudio();
    startGame(overrides);
    void navigate({ to: "/play" });
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-10 pt-4 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 lg:pt-10">
      <section className="stagger-in">
        <p className="text-xs font-medium tracking-[0.18em] text-muted uppercase">
          Quant arithmetic
        </p>
        <h1 className="mt-3 font-display text-4xl leading-[1.05] font-medium tracking-tight text-fg sm:text-5xl">
          {name ? (
            <>
              Hello, <span className="italic">{name}</span>.
            </>
          ) : (
            <>
              Arithmetic,
              <br />
              <span className="italic">sharpened.</span>
            </>
          )}
        </h1>
        <p className="mt-5 max-w-md text-base leading-relaxed text-muted">
          Pick a clock, set the numbers you want, then type. Correct answers
          advance on their own.
        </p>
        <p className="mt-4 font-display text-2xl italic tracking-tight text-fg">
          Lock in.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button size="xl" onClick={() => launch()} className="min-h-12">
            {`Start ${formatDurationLabel(settings.duration)} ${modeLabel(settings.mode).toLowerCase()}`}
          </Button>
          {hydrated && sessions.length > 0 && rec.mode !== settings.mode ? (
            <button
              type="button"
              onClick={() =>
                launch({ mode: rec.mode, duration: rec.duration })
              }
              className="text-sm text-accent hover:text-fg"
            >
              Or {rec.label.toLowerCase()}
            </button>
          ) : null}
        </div>

        <SaveCallout />
      </section>

      <aside className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-2">
          <Stat
            label="Last"
            value={hydrated && last ? String(last.score) : "—"}
            hint={last ? formatDurationLabel(last.duration) : "no rounds yet"}
          />
          <Stat
            label="Best"
            value={hydrated && best ? String(best) : "—"}
            hint={`${formatDurationLabel(settings.duration)} clock`}
          />
          <Stat
            label="Streak"
            value={hydrated && streak ? String(streak) : "—"}
            hint="days with a round"
          />
        </div>

        {hydrated && weak.length > 0 ? (
          <div className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
            <p className="text-xs font-medium tracking-wide text-muted uppercase">
              Slowest facts
            </p>
            <ul className="mt-3 space-y-2">
              {weak.map((f) => (
                <li
                  key={f.key}
                  className="flex items-baseline justify-between gap-3 font-mono text-sm tabular-nums"
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
                  <span className="text-muted">{formatMs(f.emaMs)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {hydrated && sessions.length > 0 ? (
          <div className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
            <p className="text-xs font-medium tracking-wide text-muted uppercase">
              Recommended
            </p>
            <p className="mt-2 font-display text-lg tracking-tight text-fg">
              {rec.label}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              {rec.detail}
            </p>
          </div>
        ) : null}
      </aside>

      <section className="lg:col-span-2">
        <div className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)] sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-medium tracking-wide text-muted uppercase">
              Session
            </p>
            <label className="flex items-center gap-2 text-sm text-muted">
              {settings.sound ? (
                <Volume2 className="size-4" />
              ) : (
                <VolumeX className="size-4" />
              )}
              Sound
              <Switch
                checked={settings.sound}
                onCheckedChange={(v) => {
                  if (v) unlockAudio();
                  patchSettings({ sound: v });
                }}
                aria-label="Toggle sound"
              />
            </label>
          </div>

          <div
            className={
              boardEligible
                ? "mt-5 rounded-md bg-surface-2 px-3 py-2 text-xs leading-snug text-fg shadow-[var(--shadow-border)]"
                : "mt-5 rounded-md bg-bg/40 px-3 py-2 text-xs leading-snug text-muted shadow-[var(--shadow-border)]"
            }
          >
            {boardEligible ? (
              <>Leaderboard round — Classic 120s, all ops, desk mix. This run counts.</>
            ) : (
              <>
                Custom mods — practice only, does not rank.{" "}
                <button
                  type="button"
                  className="underline underline-offset-2 hover:text-fg"
                  onClick={() =>
                    patchSettings({
                      ...BOARD_STANDARD,
                      sound: settings.sound,
                    })
                  }
                >
                  Reset to default round
                </button>
              </>
            )}
          </div>

          <p className="mt-5 text-xs font-medium text-muted">Mode</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => patchSettings({ mode: m.id })}
                className={cn(
                  "rounded-md px-3 py-3 text-left shadow-[var(--shadow-border)] transition-[background-color,box-shadow] duration-150",
                  settings.mode === m.id
                    ? "bg-surface-2 shadow-[var(--shadow-border-hover)]"
                    : "bg-bg/40 hover:bg-surface-2/60",
                )}
              >
                <span className="block text-sm font-medium text-fg">
                  {m.name}
                </span>
                <span className="mt-1 block text-xs leading-snug text-muted">
                  {m.blurb}
                </span>
              </button>
            ))}
          </div>

          <p className="mt-5 text-xs font-medium text-muted">Duration</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => patchSettings({ duration: d })}
                className={cn(
                  "h-11 min-w-14 rounded-sm px-3 font-mono text-sm tabular-nums shadow-[var(--shadow-border)] transition-colors duration-150",
                  settings.duration === d
                    ? "bg-primary text-primary-fg"
                    : "bg-bg/40 text-muted hover:text-fg",
                )}
              >
                {d}s
              </button>
            ))}
          </div>

          <p className="mt-5 text-xs font-medium text-muted">Operations</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {OPS.map((op) => (
              <button
                key={op}
                type="button"
                onClick={() => toggleOp(op)}
                className={cn(
                  "flex h-11 min-w-11 items-center justify-center rounded-sm px-4 font-display text-lg shadow-[var(--shadow-border)] transition-colors duration-150",
                  settings[op]
                    ? "bg-surface-2 text-fg"
                    : "bg-bg/40 text-subtle",
                )}
                aria-pressed={settings[op]}
                aria-label={op}
              >
                {OP_SYMBOL[op]}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="lg:col-span-2">
        <p className="mb-2 text-xs text-muted">
          Number ranges below are also mods — desk mix is required for the
          leaderboard.
        </p>
        <NumbersSettings settings={settings} onPatch={patchSettings} />
      </section>
    </div>
  );
}

function SaveCallout() {
  const durable = canUseLocalStorage();
  return (
    <>
      <SignedOut>
        <div className="mt-8 max-w-md rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <p className="text-sm font-medium text-fg">
            {durable
              ? "This browser is keeping a copy."
              : "This window cannot remember you."}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            {durable
              ? "Sign in and the same facts, heatmap, and scores follow you on another phone or laptop."
              : "Sign in now or the next refresh wipes the round."}
          </p>
          <Link
            to="/login"
            className="mt-3 inline-flex h-11 items-center text-sm text-accent hover:text-fg"
          >
            Save my progress
          </Link>
        </div>
      </SignedOut>
      <SignedIn>
        <p className="mt-6 text-sm text-muted">Saved to your account.</p>
      </SignedIn>
    </>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-lg bg-surface px-3 py-3 shadow-[var(--shadow-border)]">
      <p className="text-[11px] tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-1 font-mono text-2xl tabular-nums text-fg">{value}</p>
      <p className="mt-1 truncate text-[11px] text-subtle">{hint}</p>
    </div>
  );
}
