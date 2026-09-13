import { useNavigate } from "@tanstack/react-router";
import { Pause, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Numpad } from "@/components/game/numpad";
import { ResultsView } from "@/components/game/results-view";
import { Button } from "@/components/ui/button";
import { playCorrect, playFinish, playStart, unlockAudio } from "@/lib/game/audio";
import { formatPpm } from "@/lib/game/format";
import { useGameStore } from "@/lib/game/store";
import { OP_SYMBOL, problemText } from "@/lib/game/types";
import { cn } from "@/lib/utils";

function normalizeAnswer(raw: string): string {
  if (raw === "" || raw === "-") return raw;
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  return String(n);
}

export function PlayView() {
  const navigate = useNavigate();
  const phase = useGameStore((s) => s.phase);
  const gameId = useGameStore((s) => s.gameId);
  const problem = useGameStore((s) => s.problem);
  const score = useGameStore((s) => s.score);
  const settings = useGameStore((s) => s.settings);
  const lastResult = useGameStore((s) => s.lastResult);
  const startGame = useGameStore((s) => s.startGame);
  const noteAttempt = useGameStore((s) => s.noteAttempt);
  const endGame = useGameStore((s) => s.endGame);
  const pause = useGameStore((s) => s.pause);
  const resume = useGameStore((s) => s.resume);
  const goIdle = useGameStore((s) => s.goIdle);
  const playAgain = useGameStore((s) => s.playAgain);
  const hydrate = useGameStore((s) => s.hydrate);

  const [input, setInput] = useState("");
  const [remainingMs, setRemainingMs] = useState(settings.duration * 1000);
  const [usePad, setUsePad] = useState(false);

  const startPerf = useRef(0);
  const pauseTotal = useRef(0);
  const pauseAt = useRef<number | null>(null);
  const problemAt = useRef(0);
  const errorsRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const ended = useRef(false);
  const typed = useRef("");

  const elapsedNow = useCallback((t: number) => {
    const extra = pauseAt.current != null ? t - pauseAt.current : 0;
    return t - startPerf.current - pauseTotal.current - extra;
  }, []);

  useEffect(() => {
    hydrate();
    if (phase === "results") return;
    const s = useGameStore.getState();
    if (s.phase === "idle" || s.gameId === 0) {
      unlockAudio();
      startGame();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const coarse =
      typeof window !== "undefined" &&
      (window.matchMedia("(pointer: coarse)").matches ||
        window.matchMedia("(max-width: 640px)").matches);
    setUsePad(coarse);
  }, []);

  useEffect(() => {
    if (gameId === 0) return;
    ended.current = false;
    startPerf.current = performance.now();
    pauseTotal.current = 0;
    pauseAt.current = null;
    problemAt.current = performance.now();
    errorsRef.current = 0;
    typed.current = "";
    setInput("");
    setRemainingMs(useGameStore.getState().settings.duration * 1000);
    playStart(useGameStore.getState().settings.sound);
    inputRef.current?.focus();
  }, [gameId]);

  useEffect(() => {
    problemAt.current = performance.now();
    errorsRef.current = 0;
    typed.current = "";
    setInput("");
    inputRef.current?.focus();
  }, [problem?.key]);

  useEffect(() => {
    if (phase === "paused") {
      if (pauseAt.current == null) pauseAt.current = performance.now();
      return;
    }
    if (phase === "playing" && pauseAt.current != null) {
      pauseTotal.current += performance.now() - pauseAt.current;
      pauseAt.current = null;
      problemAt.current = performance.now();
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== "playing") return;
    let raf = 0;
    const loop = (t: number) => {
      const durationMs = useGameStore.getState().settings.duration * 1000;
      const left = Math.max(0, durationMs - elapsedNow(t));
      setRemainingMs(left);
      if (left <= 0) {
        if (!ended.current) {
          ended.current = true;
          const sound = useGameStore.getState().settings.sound;
          endGame(durationMs, true);
          playFinish(sound, true);
        }
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, gameId, elapsedNow, endGame]);

  const finishEarly = useCallback(() => {
    if (ended.current) return;
    ended.current = true;
    const t = performance.now();
    const sound = useGameStore.getState().settings.sound;
    endGame(elapsedNow(t), false);
    playFinish(sound, false);
  }, [elapsedNow, endGame]);

  const applyInput = useCallback(
    (nextRaw: string) => {
      if (phase !== "playing") return;
      const problemNow = useGameStore.getState().problem;
      if (!problemNow) return;
      const cleaned = nextRaw.replace(/[^\d-]/g, "");
      let next = cleaned;
      if (next.startsWith("-")) {
        next = `-${next.slice(1).replace(/-/g, "")}`;
      } else {
        next = next.replace(/-/g, "");
      }
      typed.current = next;
      setInput(next);
      if (next === "" || next === "-") return;

      const normalized = normalizeAnswer(next);
      const target = String(problemNow.answer);
      if (normalized === target) {
        const ms = Math.max(80, performance.now() - problemAt.current);
        unlockAudio();
        playCorrect(useGameStore.getState().settings.sound);
        typed.current = "";
        noteAttempt(ms, errorsRef.current);
        return;
      }
      if (normalized.replace("-", "").length > target.replace("-", "").length) {
        errorsRef.current += 1;
      }
    },
    [noteAttempt, phase],
  );

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      unlockAudio();
      if (e.key === "Escape") {
        e.preventDefault();
        const p = useGameStore.getState().phase;
        if (p === "paused") resume();
        else if (p === "playing") pause();
        return;
      }
      if (useGameStore.getState().phase !== "playing") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Backspace") {
        e.preventDefault();
        applyInput(typed.current.slice(0, -1));
        return;
      }
      if (/^[0-9]$/.test(e.key) || e.key === "-") {
        e.preventDefault();
        applyInput(typed.current + e.key);
      }
    },
    [applyInput, pause, resume],
  );

  useEffect(() => {
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onKey]);

  const durationMs = settings.duration * 1000;
  const frac = durationMs <= 0 ? 0 : remainingMs / durationMs;
  const urgent = remainingMs <= 10_000;
  const elapsedMin = Math.max(
    0.001,
    (durationMs - remainingMs) / 60000,
  );
  const pace = score / elapsedMin;

  if (phase === "results" && lastResult) {
    return <ResultsView />;
  }

  return (
    <div className="page-motion page-motion--play relative flex min-h-dvh flex-col bg-bg text-fg">
      <div
        className="timer-bar absolute top-0 left-0 h-[3px] w-full bg-accent"
        style={{
          transform: `scaleX(${Math.max(0, frac)})`,
          backgroundColor: urgent ? "var(--color-terra)" : "var(--color-accent)",
        }}
      />

      <header data-play-chrome="header" className="flex items-center justify-between px-5 pt-6 sm:px-8">
        <button
          type="button"
          onClick={pause}
          className="flex h-11 items-center gap-1.5 text-sm text-muted hover:text-fg"
        >
          <Pause className="size-4" />
          Pause
        </button>
        <span className="font-display italic text-muted">Hone</span>
        <button
          type="button"
          onClick={() => {
            unlockAudio();
            playAgain();
          }}
          className="flex h-11 items-center gap-1.5 text-sm text-muted hover:text-fg"
          aria-label="Restart session"
        >
          <RotateCcw className="size-4" />
          Restart
        </button>
      </header>

      <div data-play-chrome="score" className="mt-4 flex items-end justify-between px-5 sm:px-8">
        <div>
          <p className="text-[11px] tracking-wide text-muted uppercase">Time</p>
          <p
            className={cn(
              "font-mono text-3xl tabular-nums sm:text-4xl",
              urgent ? "text-terra" : "text-fg",
            )}
          >
            {Math.max(0, Math.ceil(remainingMs / 1000))}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] tracking-wide text-muted uppercase">
            Score
          </p>
          <p className="font-mono text-3xl tabular-nums text-fg sm:text-4xl">
            {score}
          </p>
          <p className="mt-0.5 font-mono text-xs tabular-nums text-subtle">
            {formatPpm(pace)}/min
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-4 pb-6">
        {problem ? (
          <div
            key={problem.key}
            className="problem-enter flex flex-wrap items-baseline justify-center gap-x-3 font-display tracking-tight"
            data-answer={problem.answer}
            data-problem-key={problem.key}
          >
            <span className="text-5xl text-fg tabular-nums sm:text-7xl">
              {problem.a}
            </span>
            <span className="text-4xl text-muted sm:text-6xl">
              {OP_SYMBOL[problem.op]}
            </span>
            <span className="text-5xl text-fg tabular-nums sm:text-7xl">
              {problem.b}
            </span>
            <span className="text-4xl text-subtle sm:text-6xl">=</span>
            <span className="relative inline-flex min-h-[1em] min-w-[2.5ch] items-baseline text-5xl text-accent tabular-nums sm:text-7xl">
              <span aria-hidden="true" className="pointer-events-none">
                {input || " "}
                {phase === "playing" ? <span className="caret" /> : null}
              </span>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => applyInput(e.target.value)}
                onBlur={() => {
                  if (useGameStore.getState().phase === "playing") {
                    inputRef.current?.focus();
                  }
                }}
                inputMode={usePad ? "none" : "numeric"}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                aria-label="Answer"
                readOnly={usePad}
                className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
              />
            </span>
          </div>
        ) : (
          <p className="text-muted">Preparing…</p>
        )}
        <span className="sr-only">{problem ? problemText(problem) : ""}</span>
      </div>

      {usePad && phase === "playing" ? (
        <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Numpad
            onDigit={(d) => applyInput(input + d)}
            onBackspace={() => applyInput(typed.current.slice(0, -1))}
          />
        </div>
      ) : (
        <p className="pb-8 text-center text-xs text-subtle">
          Type to answer · Esc to pause
        </p>
      )}

      {phase === "paused" ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg/85 px-5">
          <div className="w-full max-w-sm rounded-xl bg-surface p-6 shadow-[var(--shadow-border)]">
            <h2 className="font-display text-2xl tracking-tight">Paused</h2>
            <p className="mt-2 text-sm text-muted">
              Timer is frozen. Resume, or end and keep the facts you already
              solved.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Button onClick={resume} size="lg">
                Resume
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  unlockAudio();
                  playAgain();
                }}
                size="lg"
              >
                Restart
              </Button>
              <Button variant="secondary" onClick={finishEarly} size="lg">
                End session
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  goIdle();
                  void navigate({ to: "/" });
                }}
              >
                Discard
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
