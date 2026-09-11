import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { unlockAudio } from "@/lib/game/audio";
import { formatDurationLabel, formatMs, formatPpm } from "@/lib/game/format";
import { modeLabel, useGameStore } from "@/lib/game/store";
import { OP_LABEL, OP_SYMBOL, problemText } from "@/lib/game/types";

export function ResultsView() {
  const navigate = useNavigate();
  const result = useGameStore((s) => s.lastResult);
  const bestByDuration = useGameStore((s) => s.bestByDuration);
  const playAgain = useGameStore((s) => s.playAgain);
  const startGame = useGameStore((s) => s.startGame);
  const goIdle = useGameStore((s) => s.goIdle);

  if (!result) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg">
        <p className="text-muted">No session to show.</p>
      </div>
    );
  }

  const { session, improvements, weakNow } = result;
  const storedBest = bestByDuration[String(session.duration)];
  const isBest =
    session.completed && session.score > 0 && storedBest === session.score;
  const behind =
    storedBest != null && session.score < storedBest
      ? storedBest - session.score
      : null;

  let mark = "First mark on this clock.";
  if (!session.completed) {
    mark = "Ended before the clock — this doesn’t replace your best.";
  } else if (isBest) {
    mark = storedBest === session.score ? "Personal best for this clock." : mark;
  } else if (behind != null) {
    mark = `${behind} behind your best of ${storedBest}.`;
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col bg-bg px-5 py-8 sm:px-8">
      <p className="text-xs font-medium tracking-[0.18em] text-muted uppercase">
        {session.completed ? "Session complete" : "Ended early"} ·{" "}
        {modeLabel(session.mode)} · {formatDurationLabel(session.duration)}
      </p>
      <div className="stagger-in mt-4">
        <p className="font-display text-7xl leading-none tracking-tight tabular-nums text-fg sm:text-8xl">
          {session.score}
        </p>
        <p className="mt-3 text-muted">
          {formatPpm(session.ppm)} per minute
          {session.errors > 0 ? ` · ${session.errors} miss${session.errors === 1 ? "" : "es"}` : ""}
        </p>
        <p className="mt-1 text-sm text-subtle">{mark}</p>
      </div>

      {session.perOp.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-xs font-medium tracking-wide text-muted uppercase">
            By operation
          </h2>
          <ul className="mt-3 divide-y divide-border">
            {session.perOp.map((row) => (
              <li
                key={row.op}
                className="flex items-baseline justify-between gap-4 py-2.5"
              >
                <span className="flex items-center gap-2 text-sm text-fg">
                  <span className="font-display w-4 text-lg text-muted">
                    {OP_SYMBOL[row.op]}
                  </span>
                  {OP_LABEL[row.op]}
                </span>
                <span className="font-mono text-sm tabular-nums text-muted">
                  {row.n} · {formatMs(row.totalMs / row.n)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {session.slowest.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-xs font-medium tracking-wide text-muted uppercase">
            Slowest this round
          </h2>
          <ul className="mt-3 space-y-2">
            {session.slowest.slice(0, 5).map((e, i) => (
              <li
                key={`${e.key}-${i}`}
                className="flex items-baseline justify-between font-mono text-sm tabular-nums"
              >
                <span className="text-fg">
                  {problemText({
                    op: e.op,
                    a: e.a,
                    b: e.b,
                    answer: e.answer,
                    key: e.key,
                  })}
                </span>
                <span className="text-muted">{formatMs(e.ms)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {improvements.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-xs font-medium tracking-wide text-muted uppercase">
            Faster than last time
          </h2>
          <ul className="mt-3 space-y-2">
            {improvements.map((e, i) => (
              <li
                key={`${e.key}-imp-${i}`}
                className="flex items-baseline justify-between font-mono text-sm tabular-nums"
              >
                <span className="text-fg">
                  {problemText({
                    op: e.op,
                    a: e.a,
                    b: e.b,
                    answer: e.answer,
                    key: e.key,
                  })}
                </span>
                <span className="text-sage">
                  {formatMs(e.prevEma ?? 0)} → {formatMs(e.ms)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {weakNow.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-xs font-medium tracking-wide text-muted uppercase">
            Still lagging
          </h2>
          <ul className="mt-3 space-y-2">
            {weakNow.slice(0, 4).map((f) => (
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
                <span className="text-muted">{formatMs(f.emaMs)} avg</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-10 flex flex-col gap-2 sm:flex-row">
        <Button
          size="lg"
          className="flex-1"
          onClick={() => {
            unlockAudio();
            playAgain();
          }}
        >
          Play again
        </Button>
        <Button
          size="lg"
          variant="secondary"
          className="flex-1"
          onClick={() => {
            unlockAudio();
            startGame({ mode: "focus", duration: 60 });
          }}
        >
          Focus 60s
        </Button>
      </div>
      <div className="mt-3 flex gap-2">
        <Button
          variant="ghost"
          className="flex-1"
          onClick={() => {
            goIdle();
            void navigate({ to: "/" });
          }}
        >
          Change settings
        </Button>
        <Button variant="ghost" className="flex-1" asChild>
          <Link to="/progress">See progress</Link>
        </Button>
      </div>
    </div>
  );
}
